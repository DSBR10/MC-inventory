import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getRequestContext, isValidAuditUuid, recordAuditEvent, sanitizeAuditMetadata } from "@/lib/audit/server";
import { authOptions } from "@/lib/auth/options";
import type { AuditClientBatch, AuditClientEvent, AuditResult } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH_SIZE = 25;
const actionPattern = /^(?:ui|navigation|preference|export|auth|api)\.[a-z0-9_.-]{1,110}$/;
const allowedResults = new Set<AuditResult>(["success", "failure", "denied", "error", "partial"]);

function validRoute(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 512
    && value.startsWith("/")
    && !value.includes("?")
    && !value.includes("#")
    && !value.includes("\\");
}

function parseBatch(value: unknown): AuditClientBatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const clientSessionId = typeof candidate.clientSessionId === "string" ? candidate.clientSessionId : null;
  const navigationId = typeof candidate.navigationId === "string" ? candidate.navigationId : null;
  const batchOperationId = typeof candidate.operationId === "string" ? candidate.operationId : undefined;
  if (!isValidAuditUuid(clientSessionId) || !isValidAuditUuid(navigationId)) return null;
  if (candidate.operationId !== undefined && !isValidAuditUuid(batchOperationId)) return null;
  if (!Array.isArray(candidate.events) || candidate.events.length < 1 || candidate.events.length > MAX_BATCH_SIZE) return null;

  const events: AuditClientEvent[] = [];
  for (const rawEvent of candidate.events) {
    if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) return null;
    const event = rawEvent as Record<string, unknown>;
    const id = typeof event.id === "string" ? event.id : null;
    const action = typeof event.action === "string" ? event.action : null;
    const category = typeof event.category === "string" ? event.category : null;
    const result = typeof event.result === "string" ? event.result as AuditResult : undefined;
    const durationMs = typeof event.durationMs === "number" ? event.durationMs : undefined;
    const operationId = typeof event.operationId === "string" ? event.operationId : undefined;
    const interactionId = typeof event.interactionId === "string" ? event.interactionId : undefined;

    if (!isValidAuditUuid(id) || !action || !actionPattern.test(action)) return null;
    if (!validRoute(event.route)) return null;
    if (!category || !new Set(["ui", "navigation", "export"]).has(category)) return null;
    if (event.result !== undefined && (!result || !allowedResults.has(result))) return null;
    if (event.durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs! < 0 || durationMs! > 86_400_000)) return null;
    if (event.operationId !== undefined && !isValidAuditUuid(operationId)) return null;
    if (event.interactionId !== undefined && !isValidAuditUuid(interactionId)) return null;
    if (event.metadata !== undefined && (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata))) return null;

    events.push({
      id,
      action,
      category: category as AuditClientEvent["category"],
      route: event.route,
      result,
      durationMs,
      metadata: sanitizeAuditMetadata(event.metadata),
      operationId,
      interactionId,
    });
  }

  return {
    clientSessionId,
    navigationId,
    operationId: batchOperationId,
    events,
  };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const allowedOrigins = new Set([new URL(request.url).origin]);
    if (process.env.NEXTAUTH_URL) allowedOrigins.add(new URL(process.env.NEXTAUTH_URL).origin);
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const batch = parseBatch(body);
  if (!batch) {
    return NextResponse.json({ error: "Invalid audit batch" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user && batch.events.some((event) => event.route !== "/login")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const baseContext = getRequestContext(request);
  try {
    for (const event of batch.events) {
      await recordAuditEvent({
        id: event.id,
        session,
        actorType: session?.user ? "user" : "anonymous",
        action: event.action,
        category: event.category,
        source: "client",
        confidence: "observed",
        result: event.result || "success",
        statusCode: 200,
        durationMs: event.durationMs,
        targetType: "ui",
        operationId: event.operationId || batch.operationId,
        clientSessionId: batch.clientSessionId,
        navigationId: batch.navigationId,
        interactionId: event.interactionId,
        metadata: event.metadata,
        context: {
          ...baseContext,
          requestId: event.id,
          method: "UI",
          route: event.route,
        },
      });
    }

    return NextResponse.json({ accepted: batch.events.length });
  } catch {
    return NextResponse.json({ error: "Audit persistence unavailable" }, { status: 503 });
  }
}
