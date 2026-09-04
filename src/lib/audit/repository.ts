import { queryAudit } from "@/lib/db/pool";
import type { AuditResult, JsonValue } from "@/types/audit";

export type AuditFilters = {
  from?: string;
  to?: string;
  actor?: string;
  action?: string;
  result?: AuditResult;
  route?: string;
  ip?: string;
};

export type DbAuditEvent = {
  id: string;
  occurred_at: string | Date;
  request_id: string;
  actor_user_id: string;
  actor_email: string;
  actor_name: string;
  actor_role: string;
  action: string;
  method: string;
  route: string;
  result: AuditResult;
  status_code: number;
  ip: string;
  user_agent: string;
  duration_ms: number | null;
  metadata: Record<string, JsonValue>;
};

function buildWhere(filters: AuditFilters) {
  const values: unknown[] = [];
  const clauses: string[] = [];
  const parameter = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.from) clauses.push(`occurred_at >= ${parameter(filters.from)}::timestamptz`);
  if (filters.to) clauses.push(`occurred_at < ${parameter(filters.to)}::timestamptz`);
  if (filters.actor) {
    const exact = parameter(filters.actor);
    const email = parameter(filters.actor);
    const name = parameter(`%${filters.actor}%`);
    clauses.push(`(actor_user_id = ${exact} OR actor_email = ${email} OR actor_name ILIKE ${name})`);
  }
  if (filters.action) clauses.push(`action = ${parameter(filters.action)}`);
  if (filters.result) clauses.push(`result = ${parameter(filters.result)}`);
  if (filters.route) clauses.push(`route ILIKE ${parameter(`%${filters.route}%`)}`);
  if (filters.ip) clauses.push(`ip = ${parameter(filters.ip)}`);

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

export async function listAuditEvents(filters: AuditFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const listValues = [...where.values, limit, offset];
  const limitParameter = `$${listValues.length - 1}`;
  const offsetParameter = `$${listValues.length}`;

  const [events, count, summary] = await Promise.all([
    queryAudit<DbAuditEvent>(
      `SELECT id, occurred_at, request_id, actor_user_id, actor_email, actor_name, actor_role,
              action, method, route, result, status_code, ip, user_agent, duration_ms, metadata
       FROM audit_events ${where.sql}
       ORDER BY occurred_at DESC, id DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      listValues,
    ),
    queryAudit<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit_events ${where.sql}`,
      where.values,
    ),
    queryAudit<{ result: AuditResult; total: string }>(
      `SELECT result, COUNT(*)::text AS total
       FROM audit_events ${where.sql}
       GROUP BY result`,
      where.values,
    ),
  ]);

  const counts: Record<AuditResult, number> = {
    success: 0,
    failure: 0,
    denied: 0,
    error: 0,
    partial: 0,
  };
  for (const row of summary.rows) counts[row.result] = Number(row.total);

  return {
    events: events.rows,
    total: Number(count.rows[0]?.total || 0),
    counts,
  };
}

export async function getAuditEvent(id: string) {
  const result = await queryAudit<DbAuditEvent>(
    `SELECT id, occurred_at, request_id, actor_user_id, actor_email, actor_name, actor_role,
            action, method, route, result, status_code, ip, user_agent, duration_ms, metadata
     FROM audit_events WHERE id = $1::uuid`,
    [id],
  );
  return result.rows[0] || null;
}

export async function exportAuditEvents(filters: AuditFilters, limit: number) {
  const where = buildWhere(filters);
  const limitParameter = `$${where.values.length + 1}`;
  return queryAudit<DbAuditEvent>(
    `SELECT id, occurred_at, request_id, actor_user_id, actor_email, actor_name, actor_role,
            action, method, route, result, status_code, ip, user_agent, duration_ms, metadata
     FROM audit_events ${where.sql}
     ORDER BY occurred_at DESC, id DESC
     LIMIT ${limitParameter}`,
    [...where.values, limit],
  );
}
