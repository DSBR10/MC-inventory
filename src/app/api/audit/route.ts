import { NextRequest, NextResponse } from "next/server";

import { recordApiAudit } from "@/lib/audit/server";
import { listAuditEvents, type AuditFilters } from "@/lib/audit/repository";
import { requireApiSession } from "@/lib/auth/server";
import type { AuditResult } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const results: AuditResult[] = ["success", "failure", "denied", "error", "partial"];

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function boundedInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function textFilter(value: string | null, maxLength: number) {
  const trimmed = value?.trim() || "";
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function mapSummary(row: Awaited<ReturnType<typeof listAuditEvents>>["events"][number]) {
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
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("audit:view", request);
  if (guard.response) return guard.response;

  try {
    const params = request.nextUrl.searchParams;
    const result = params.get("result");
    const filters: AuditFilters = {
      from: parseDate(params.get("from")),
      to: parseDate(params.get("to")),
      actor: textFilter(params.get("actor"), 256),
      action: textFilter(params.get("action"), 128),
      result: result && results.includes(result as AuditResult) ? result as AuditResult : undefined,
      route: textFilter(params.get("route"), 256),
      ip: textFilter(params.get("ip"), 128),
    };
    const page = boundedInteger(params.get("page"), 1, 100_000);
    const limit = boundedInteger(params.get("limit"), 50, 100);
    const data = await listAuditEvents(filters, page, limit);

    await recordApiAudit(request, guard.session, {
      action: "audit.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { page, limit, returned: data.events.length },
    });

    return NextResponse.json({
      page,
      limit,
      total: data.total,
      pages: Math.ceil(data.total / limit),
      summary: data.counts,
      events: data.events.map(mapSummary),
    });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "audit.view",
      result: "error",
      statusCode: 500,
      startedAt,
    });
    return NextResponse.json({ error: "No se pudo consultar la auditoría" }, { status: 500 });
  }
}
