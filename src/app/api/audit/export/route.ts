import { NextRequest } from "next/server";

import { recordApiAudit, sanitizeAuditMetadata } from "@/lib/audit/server";
import { exportAuditEvents, type AuditFilters } from "@/lib/audit/repository";
import { requireApiSession } from "@/lib/auth/server";
import type { AuditResult } from "@/types/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 5_000;
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const resultValues: AuditResult[] = ["success", "failure", "denied", "error", "partial"];

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
      return new Response("Rango de exportación inválido", { status: 400 });
    }

    const result = params.get("result");
    const filters: AuditFilters = {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      actor: params.get("actor")?.trim().slice(0, 256) || undefined,
      action: params.get("action")?.trim().slice(0, 128) || undefined,
      result: result && resultValues.includes(result as AuditResult) ? result as AuditResult : undefined,
      route: params.get("route")?.trim().slice(0, 256) || undefined,
      ip: params.get("ip")?.trim().slice(0, 128) || undefined,
    };
    const resultSet = await exportAuditEvents(filters, MAX_EXPORT_ROWS);
    const header = ["id", "occurred_at", "request_id", "actor_email", "actor_name", "actor_role", "action", "method", "route", "result", "status_code", "ip", "user_agent", "duration_ms", "metadata"];
    const rows = resultSet.rows.map((row) => [
      row.id,
      new Date(row.occurred_at).toISOString(),
      row.request_id,
      row.actor_email,
      row.actor_name,
      row.actor_role,
      row.action,
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
