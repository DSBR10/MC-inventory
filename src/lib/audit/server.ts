import { createHmac, randomUUID } from "node:crypto";

import type { Session } from "next-auth";

import { queryAudit } from "@/lib/db/pool";
import { resolveSecret } from "@/lib/secrets/crypto";
import type {
  AuditEventInput,
  AuditRequestContext,
  AuditResult,
  JsonValue,
} from "@/types/audit";

const MAX_STRING_LENGTH = 512;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_METADATA_DEPTH = 6;
const MAX_METADATA_KEYS = 64;
const MAX_METADATA_ARRAY_ITEMS = 64;
const MAX_METADATA_JSON_BYTES = 24_000;
const MAX_COMMAND_PREVIEW_LENGTH = 320;

const deniedKeyPattern = /(?:authorization|cookie|password|passwd|pwd|token|secret|credential|session|private[_-]?key|access[_-]?key|api[_-]?key|client[_-]?secret|stdout|stderr|output|rawcommand|command(?!preview|hash))/i;
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

function validUuid(value: string | null) {
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
  return {
    requestId: validUuid(receivedRequestId ?? null) ? receivedRequestId! : randomUUID(),
    occurredAt: new Date().toISOString(),
    method: truncate((request?.method || "GET").toUpperCase(), 16),
    route: truncate(route, MAX_STRING_LENGTH),
    ip,
    userAgent: headerValue(request, "user-agent", MAX_USER_AGENT_LENGTH),
  };
}

export function getAuditHashSecret() {
  // Soporta valor cifrado ENC:v1:... (se descifra solo en memoria).
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

function actorFromSession(session: Session): [string, string, string, string] {
  if (!session?.user) throw new AuditConfigurationError();
  return [
    truncate(session.user.id || "unknown", MAX_STRING_LENGTH),
    truncate(session.user.email || "unknown", MAX_STRING_LENGTH),
    truncate(session.user.name || "unknown", MAX_STRING_LENGTH),
    truncate(session.user.role || "unknown", 64),
  ];
}

export async function recordAuditEvent(input: AuditEventInput) {
  const [actorUserId, actorEmail, actorName, actorRole] = actorFromSession(input.session);
  const context = input.context || getRequestContext(input.request);
  const metadata = sanitizeAuditMetadata(input.metadata || {});
  const id = randomUUID();
  const durationMs = input.durationMs === undefined
    ? null
    : Math.max(0, Math.min(Math.round(input.durationMs), 2_147_483_647));

  try {
    await queryAudit(
      `INSERT INTO audit_events
        (id, occurred_at, request_id, actor_user_id, actor_email, actor_name, actor_role,
         action, method, route, result, status_code, ip, user_agent, duration_ms, metadata)
       VALUES ($1::uuid, $2::timestamptz, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)`,
      [
        id,
        context.occurredAt,
        context.requestId,
        actorUserId,
        actorEmail,
        actorName,
        actorRole,
        truncate(input.action, 128),
        context.method,
        context.route,
        input.result,
        input.statusCode,
        context.ip,
        context.userAgent,
        durationMs,
        JSON.stringify(metadata),
      ],
    );
    return id;
  } catch {
    throw new AuditPersistenceError();
  }
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
  },
) {
  try {
    await recordAuditEvent({
      request,
      session,
      action: input.action,
      result: input.result,
      statusCode: input.statusCode,
      durationMs: input.startedAt === undefined ? undefined : Date.now() - input.startedAt,
      metadata: input.metadata,
    });
  } catch {
    // Observability must never expose database or credential errors to callers.
  }
}
