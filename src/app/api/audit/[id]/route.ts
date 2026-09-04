import { NextRequest, NextResponse } from "next/server";

import { recordApiAudit, sanitizeAuditMetadata } from "@/lib/audit/server";
import { getAuditEvent } from "@/lib/audit/repository";
import { requireApiSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapDetail(row: NonNullable<Awaited<ReturnType<typeof getAuditEvent>>>) {
  return {
    id: row.id,
    occurredAt: new Date(row.occurred_at).toISOString(),
    requestId: row.request_id,
    actor: {
      userId: row.actor_user_id,
      email: row.actor_email,
      name: row.actor_name,
      role: row.actor_role,
    },
    action: row.action,
    method: row.method,
    route: row.route,
    result: row.result,
    statusCode: row.status_code,
    ip: row.ip,
    userAgent: row.user_agent,
    durationMs: row.duration_ms,
    metadata: sanitizeAuditMetadata(row.metadata),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const guard = await requireApiSession("audit:view", request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    const event = await getAuditEvent(id);
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    await recordApiAudit(request, guard.session, {
      action: "audit.detail.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { eventId: id },
    });
    return NextResponse.json({ event: mapDetail(event) });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "audit.detail.view",
      result: "error",
      statusCode: 500,
      startedAt,
    });
    return NextResponse.json({ error: "No se pudo consultar el evento" }, { status: 500 });
  }
}
