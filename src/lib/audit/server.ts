import { createHmac, randomUUID } from "node:crypto";

import type { Session } from "next-auth";
import type { PoolClient } from "pg";

import { getAuditPool, queryAudit } from "@/lib/db/pool";
import { resolveSecret } from "@/lib/secrets/crypto";
import type {
  AuditActor,
  AuditCategory,
  AuditConfidence,
  AuditEventInput,
  AuditRequestContext,
  AuditResult,
  AuditSource,
  JsonValue,
} from "@/types/audit";

const MAX_STRING_LENGTH = 512;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_METADATA_DEPTH = 6;
const MAX_METADATA_KEYS = 64;
const MAX_METADATA_ARRAY_ITEMS = 64;
const MAX_METADATA_JSON_BYTES = 24_000;
const MAX_COMMAND_PREVIEW_LENGTH = 320;

const deniedKeyPattern = /(?:authorization|cookie|password|passwd|pwd|token|secret|credential|session|private[_-]?key|access[_-]?key|api[_-]?key|client[_-]?secret|stdout|stderr|output|rawcommand|command(?!preview|hash|length))/i;
const safeKeyPattern = /^[a-zA-Z][a-zA-Z0-9_.:-]{0,63}$/;

export class AuditConfigurationError extends Error {
  constructor() {
    super("AUDIT_CONFIGURATION_ERROR");
    this.name = "AuditConfigurationError";
  }
}

export class AuditPersistenceError extends Error {
  constructor() {
    super("AUDIT_PERSISTENCE_ERROR");
    this.name = "AuditPersistenceError";
  }
}

function truncate(value: string, maxLength = MAX_STRING_LENGTH) {
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function redactSensitiveText(value: string, maxLength = MAX_STRING_LENGTH) {
  let redacted = value;
  redacted = redacted.replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gi, "[REDACTED_KEY]");
  redacted = redacted.replace(/\bAKIA[0-9A-Z]{16}\b/gi, "[REDACTED_AWS_KEY]");
  redacted = redacted.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  redacted = redacted.replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  redacted = redacted.replace(
    /((?:^|[\s;&|])(?:--?|\/)?(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|authorization|cookie|session)(?:\s+|=|:)\s*)(["']?)[^\s;|"']+\2/gi,
    "$1[REDACTED]",
  );
  redacted = redacted.replace(
    /((?:^|[\s;&|])[A-Z0-9_]*(?:PASSWORD|TOKEN|SECRET|API_KEY|ACCESS_KEY)[A-Z0-9_]*\s*=\s*)([^\s;|]+)/gi,
    "$1[REDACTED]",
  );
  return truncate(redacted, maxLength);
}

export function redactCommandPreview(command: string) {
  return redactSensitiveText(command.trim(), MAX_COMMAND_PREVIEW_LENGTH);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): JsonValue | undefined {
  if (depth > MAX_METADATA_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string") return redactSensitiveText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : "[INVALID_NUMBER]";
  if (typeof value === "boolean" || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (!isObject(value)) return "[UNSUPPORTED_VALUE]";
  if (seen.has(value)) return "[CIRCULAR_VALUE]";

  seen.add(value);
  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_METADATA_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen))
      .filter((item): item is JsonValue => item !== undefined);
    seen.delete(value);
    return result;
  }

  const result: Record<string, JsonValue> = {};
  for (const childKey of Object.keys(value).slice(0, MAX_METADATA_KEYS)) {
    if (!safeKeyPattern.test(childKey) || deniedKeyPattern.test(childKey)) continue;
    const child = sanitizeValue(value[childKey], depth + 1, seen);
    if (child !== undefined) result[childKey] = child;
  }
  seen.delete(value);
  return result;
}

export function sanitizeAuditMetadata(value: unknown): Record<string, JsonValue> {
  const sanitized = sanitizeValue(value, 0, new WeakSet<object>());
  const metadata: Record<string, JsonValue> = isObject(sanitized) && !Array.isArray(sanitized)
    ? sanitized as Record<string, JsonValue>
    : { value: sanitized || "[EMPTY]" };

  try {
    if (Buffer.byteLength(JSON.stringify(metadata), "utf8") <= MAX_METADATA_JSON_BYTES) return metadata;
  } catch {
    return { truncated: true };
  }

  return { truncated: true };
}

export function isValidAuditUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function headerValue(request: Request | undefined, name: string, maxLength: number) {
  return redactSensitiveText(request?.headers.get(name)?.trim() || "unknown", maxLength);
}

export function getRequestContext(request?: Request): AuditRequestContext {
  const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = truncate(forwardedFor || request?.headers.get("x-real-ip")?.trim() || "unknown", 128);
  let route = "unknown";
  try {
    route = request ? new URL(request.url).pathname : "unknown";
  } catch {
    route = "unknown";
  }

  const receivedRequestId = request?.headers.get("x-request-id");
  const clientSessionId = request?.headers.get("x-audit-client-session") || undefined;
  const navigationId = request?.headers.get("x-audit-navigation-id") || undefined;
  const interactionId = request?.headers.get("x-audit-interaction-id") || undefined;
  return {
    requestId: isValidAuditUuid(receivedRequestId) ? receivedRequestId : randomUUID(),
    occurredAt: new Date().toISOString(),
    method: truncate((request?.method || "GET").toUpperCase(), 16),
    route: truncate(route, MAX_STRING_LENGTH),
    ip,
    userAgent: headerValue(request, "user-agent", MAX_USER_AGENT_LENGTH),
    clientSessionId: isValidAuditUuid(clientSessionId) ? clientSessionId : undefined,
    navigationId: isValidAuditUuid(navigationId) ? navigationId : undefined,
    interactionId: isValidAuditUuid(interactionId) ? interactionId : undefined,
  };
}

export function getAuditHashSecret() {
  const secret = resolveSecret(process.env.AUDIT_HASH_SECRET?.trim());
  if (!secret || secret.length < 32) throw new AuditConfigurationError();
  return secret;
}

export function hasAuditHashSecret() {
  try {
    getAuditHashSecret();
    return true;
  } catch {
    return false;
  }
}

export function hashAuditValue(value: string) {
  return createHmac("sha256", getAuditHashSecret()).update(value, "utf8").digest("hex");
}

const unknownActor: AuditActor = {
  userId: "unknown",
  email: "unknown",
  name: "Unknown",
  role: "unknown",
};

function actorFromInput(input: AuditEventInput): AuditActor {
  if (input.actor) return input.actor;
  const sessionUser = input.session?.user;
  if (!sessionUser) return unknownActor;

  return {
    userId: truncate(sessionUser.id || "unknown", MAX_STRING_LENGTH),
    email: truncate(sessionUser.email || "unknown", MAX_STRING_LENGTH),
    name: truncate(sessionUser.name || "unknown", MAX_STRING_LENGTH),
    role: truncate(sessionUser.role || "unknown", 64),
  };
}

function boundedDuration(value: number | undefined) {
  if (value === undefined) return null;
  return Math.max(0, Math.min(Math.round(value), 2_147_483_647));
}

function boundedStatus(value: number) {
  if (!Number.isInteger(value) || value < 100 || value > 599) {
    throw new AuditConfigurationError();
  }
  return value;
}

async function persistAuditEvent(
  executor: Pick<PoolClient, "query">,
  input: AuditEventInput,
) {
  const actor = actorFromInput(input);
  const context = input.context || getRequestContext(input.request);
  const metadata = sanitizeAuditMetadata(input.metadata || {});
  const id = input.id || randomUUID();
  const recordedAt = new Date().toISOString();
  const actorType = input.actorType || (input.session?.user ? "user" : input.actor ? "system" : "anonymous");
  const category: AuditCategory = input.category || "api";
  const source: AuditSource = input.source || "server";
  const confidence: AuditConfidence = input.confidence || "authoritative";

  try {
    await executor.query(
      `INSERT INTO audit_events
        (id, occurred_at, recorded_at, request_id,
         actor_user_id, actor_email, actor_name, actor_role, actor_type,
         action, category, source, confidence, auth_method,
         target_type, target_id, operation_id, client_session_id,
         navigation_id, interaction_id, parent_event_id,
         method, route, result, status_code, ip, user_agent, duration_ms, metadata)
       VALUES ($1::uuid, $2::timestamptz, $3::timestamptz, $4::uuid,
               $5, $6, $7, $8, $9,
               $10, $11, $12, $13, $14,
               $15, $16, $17::uuid, $18::uuid,
               $19::uuid, $20::uuid, $21::uuid,
               $22, $23, $24, $25, $26, $27, $28, $29::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        context.occurredAt,
        recordedAt,
        context.requestId,
        actor.userId,
        actor.email,
        actor.name,
        actor.role,
        actorType,
        truncate(input.action, 128),
        category,
        source,
        confidence,
        input.authMethod ? truncate(input.authMethod, 32) : null,
        input.targetType ? truncate(input.targetType, 64) : null,
        input.targetId ? truncate(input.targetId, MAX_STRING_LENGTH) : null,
        input.operationId || null,
        input.clientSessionId || context.clientSessionId || null,
        input.navigationId || context.navigationId || null,
        input.interactionId || context.interactionId || null,
        input.parentEventId || null,
        context.method,
        context.route,
        input.result,
        boundedStatus(input.statusCode),
        context.ip,
        context.userAgent,
        boundedDuration(input.durationMs),
        JSON.stringify(metadata),
      ],
    );
    return id;
  } catch (error) {
    if (error instanceof AuditConfigurationError) throw error;
    throw new AuditPersistenceError();
  }
}

export async function recordAuditEvent(input: AuditEventInput) {
  return persistAuditEvent(getAuditPool(), input);
}

export async function recordAuditEventWithClient(client: PoolClient, input: AuditEventInput) {
  return persistAuditEvent(client, input);
}

export async function recordApiAudit(
  request: Request,
  session: Session,
  input: {
    action: string;
    result: AuditResult;
    statusCode: number;
    startedAt?: number;
    metadata?: unknown;
    category?: AuditCategory;
    targetType?: string;
    targetId?: string;
    operationId?: string;
  },
) {
  try {
    await recordAuditEvent({
      request,
      session,
      action: input.action,
      category: input.category,
      targetType: input.targetType,
      targetId: input.targetId,
      operationId: input.operationId,
      result: input.result,
      statusCode: input.statusCode,
      durationMs: input.startedAt === undefined ? undefined : Date.now() - input.startedAt,
      metadata: input.metadata,
    });
  } catch {
    // La API de lectura no debe revelar una caída del observability store.
  }
}

export async function recordSystemAuditEvent(input: Omit<AuditEventInput, "session" | "actorType">) {
  return recordAuditEvent({
    ...input,
    actorType: "system",
    source: input.source || "job",
    category: input.category || "system",
  });
}
