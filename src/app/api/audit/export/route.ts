import { NextRequest } from "next/server";

import { recordApiAudit, sanitizeAuditMetadata } from "@/lib/audit/server";
import { exportAuditEvents, type AuditFilters } from "@/lib/audit/repository";
import { requireApiSession } from "@/lib/auth/server";
import type { AuditCategory, AuditResult, AuditSource } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 5_000;
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const resultValues: AuditResult[] = ["success", "failure", "denied", "error", "partial"];
const categoryValues: AuditCategory[] = ["api", "ui", "navigation", "authentication", "data", "command", "configuration", "export", "system"];
const sourceValues: AuditSource[] = ["server", "client", "job", "cli"];

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function dateParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("audit:export", request);
  if (guard.response) return guard.response;

  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const fromDate = dateParam(params.get("from")) || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const toDate = dateParam(params.get("to")) || now;
    if (toDate <= fromDate || toDate.getTime() - fromDate.getTime() > MAX_RANGE_MS) {
      await recordApiAudit(request, guard.session, {
        action: "audit.export",
        category: "export",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_range" },
      });
      return new Response("Rango de exportación inválido", { status: 400 });
    }

    const result = params.get("result");
    const category = params.get("category");
    const source = params.get("source");
    const filters: AuditFilters = {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      actor: params.get("actor")?.trim().slice(0, 256) || undefined,
      action: params.get("action")?.trim().slice(0, 128) || undefined,
      category: category && categoryValues.includes(category as AuditCategory) ? category as AuditCategory : undefined,
      source: source && sourceValues.includes(source as AuditSource) ? source as AuditSource : undefined,
      result: result && resultValues.includes(result as AuditResult) ? result as AuditResult : undefined,
      route: params.get("route")?.trim().slice(0, 256) || undefined,
      ip: params.get("ip")?.trim().slice(0, 128) || undefined,
    };
    const resultSet = await exportAuditEvents(filters, MAX_EXPORT_ROWS);
    const header = ["id", "occurred_at", "recorded_at", "request_id", "actor_email", "actor_name", "actor_role", "actor_type", "action", "category", "source", "confidence", "auth_method", "target_type", "target_id", "operation_id", "client_session_id", "navigation_id", "interaction_id", "parent_event_id", "method", "route", "result", "status_code", "ip", "user_agent", "duration_ms", "metadata"];
    const rows = resultSet.rows.map((row) => [
      row.id,
      new Date(row.occurred_at).toISOString(),
      new Date(row.recorded_at).toISOString(),
      row.request_id,
      row.actor_email,
      row.actor_name,
      row.actor_role,
      row.actor_type,
      row.action,
      row.category,
      row.source,
      row.confidence,
      row.auth_method,
      row.target_type,
      row.target_id,
      row.operation_id,
      row.client_session_id,
      row.navigation_id,
      row.interaction_id,
      row.parent_event_id,
      row.method,
      row.route,
      row.result,
      row.status_code,
      row.ip,
      row.user_agent,
      row.duration_ms,
      JSON.stringify(sanitizeAuditMetadata(row.metadata)),
    ].map(csvCell).join(","));
    const csv = [header.map(csvCell).join(","), ...rows].join("\r\n");

    await recordApiAudit(request, guard.session, {
      action: "audit.export",
      category: "export",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { rows: resultSet.rows.length, from: fromDate.toISOString(), to: toDate.toISOString() },
    });

    return new Response(`\uFEFF${csv}\r\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-export-${fromDate.toISOString().slice(0, 10)}-${toDate.toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "audit.export",
      result: "error",
      statusCode: 500,
      startedAt,
    });
    return new Response("No se pudo exportar la auditoría", { status: 500 });
  }
}
