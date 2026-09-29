import { queryAudit } from "@/lib/db/pool";
import type { BackupRecord, NormalizedBackup } from "./types";

function toRecord(row: any): BackupRecord {
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.account_id,
    accountName: row.account_name,
    region: row.region,
    vaultId: row.vault_id,
    vaultName: row.vault_name,
    backupId: row.backup_id,
    backupName: row.backup_name,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    resourceType: row.resource_type,
    status: row.status,
    sizeBytes: row.size_bytes !== null && row.size_bytes !== undefined ? Number(row.size_bytes) : null,
    backupCreatedAt: row.backup_created_at ? new Date(row.backup_created_at).toISOString() : null,
    backupCompletedAt: row.backup_completed_at ? new Date(row.backup_completed_at).toISOString() : null,
    backupExpiresAt: row.backup_expires_at ? new Date(row.backup_expires_at).toISOString() : null,
    raw: row.raw || {},
    collectedAt: row.collected_at ? new Date(row.collected_at).toISOString() : "",
  };
}

export async function upsertBackups(records: NormalizedBackup[]): Promise<number> {
  if (records.length === 0) return 0;
  // pg admite 65535 parámetros por statement: 17 columnas x 500 filas = 8500.
  const CHUNK = 500;
  let total = 0;
  for (let start = 0; start < records.length; start += CHUNK) {
    const chunk = records.slice(start, start + CHUNK);
    const values: unknown[] = [];
    const rows = chunk.map((r, i) => {
      const o = i * 17;
      values.push(
        r.provider, r.accountId, r.accountName, r.region,
        r.vaultId, r.vaultName, r.backupId, r.backupName,
        r.resourceId, r.resourceName, r.resourceType, r.status,
        r.sizeBytes, r.backupCreatedAt, r.backupCompletedAt,
        r.backupExpiresAt, JSON.stringify(r.raw || {}),
      );
      const ph = Array.from({ length: 17 }, (_, k) => `$${o + k + 1}`).join(", ");
      return `(${ph})`;
    });
    const res = await queryAudit(
      `INSERT INTO server_backups
        (provider, account_id, account_name, region, vault_id, vault_name, backup_id, backup_name,
         resource_id, resource_name, resource_type, status, size_bytes, backup_created_at,
         backup_completed_at, backup_expires_at, raw)
       VALUES ${rows.join(", ")}
       ON CONFLICT (provider, account_id, backup_id) DO UPDATE SET
         account_name = EXCLUDED.account_name,
         region = EXCLUDED.region,
         vault_id = EXCLUDED.vault_id,
         vault_name = EXCLUDED.vault_name,
         backup_name = EXCLUDED.backup_name,
         resource_id = EXCLUDED.resource_id,
         resource_name = EXCLUDED.resource_name,
         resource_type = EXCLUDED.resource_type,
         status = EXCLUDED.status,
         size_bytes = EXCLUDED.size_bytes,
         backup_created_at = EXCLUDED.backup_created_at,
         backup_completed_at = EXCLUDED.backup_completed_at,
         backup_expires_at = EXCLUDED.backup_expires_at,
         raw = EXCLUDED.raw,
         collected_at = now()`,
      values,
    );
    total += res.rowCount || 0;
  }
  return total;
}

export type BackupFilters = {
  provider?: string;
  accountId?: string;
  status?: string;
  resourceType?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function listBackups(filters: BackupFilters): Promise<{ records: BackupRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (filters.provider) { conditions.push(`provider = $${i++}`); values.push(filters.provider); }
  if (filters.accountId) { conditions.push(`account_id = $${i++}`); values.push(filters.accountId); }
  if (filters.status) { conditions.push(`status = $${i++}`); values.push(filters.status); }
  if (filters.resourceType) { conditions.push(`resource_type = $${i++}`); values.push(filters.resourceType); }
  if (filters.from) { conditions.push(`backup_created_at >= $${i++}`); values.push(filters.from); }
  if (filters.to) { conditions.push(`backup_created_at <= $${i++}`); values.push(filters.to); }
  if (filters.search) {
    conditions.push(`(backup_name ILIKE $${i} OR resource_name ILIKE $${i} OR backup_id ILIKE $${i} OR vault_name ILIKE $${i} OR resource_id ILIKE $${i})`);
    values.push(`%${filters.search}%`);
    i++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;

  const [countRes, rowsRes] = await Promise.all([
    queryAudit(`SELECT COUNT(*)::int AS total FROM server_backups ${where}`, values),
    queryAudit(
      `SELECT * FROM server_backups ${where} ORDER BY backup_created_at DESC NULLS LAST, collected_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, pageSize, offset],
    ),
  ]);

  return { records: rowsRes.rows.map(toRecord), total: countRes.rows[0]?.total || 0 };
}

export async function getBackupSummary(): Promise<{
  total: number;
  byProvider: Array<{ provider: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byAccount: Array<{ provider: string; accountId: string; accountName: string; total: number; lastBackup: string | null }>;
  totalBytes: number;
}> {
  const [totalRes, providerRes, statusRes, accountRes, bytesRes] = await Promise.all([
    queryAudit<{ total: number }>(`SELECT COUNT(*)::int AS total FROM server_backups`),
    queryAudit<{ provider: string; total: number }>(`SELECT provider, COUNT(*)::int AS total FROM server_backups GROUP BY provider ORDER BY total DESC`),
    queryAudit<{ status: string; total: number }>(`SELECT status, COUNT(*)::int AS total FROM server_backups GROUP BY status ORDER BY total DESC`),
    queryAudit<{ provider: string; accountId: string; accountName: string; total: number; lastBackup: Date | string | null }>(`SELECT provider, account_id AS "accountId", account_name AS "accountName", COUNT(*)::int AS total, MAX(backup_created_at) AS "lastBackup" FROM server_backups GROUP BY provider, account_id, account_name ORDER BY total DESC`),
    queryAudit<{ bytes: string }>(`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes FROM server_backups`),
  ]);
  return {
    total: totalRes.rows[0]?.total || 0,
    byProvider: providerRes.rows,
    byStatus: statusRes.rows,
    byAccount: accountRes.rows.map((r) => ({ ...r, lastBackup: r.lastBackup ? new Date(r.lastBackup).toISOString() : null })),
    totalBytes: Number(bytesRes.rows[0]?.bytes || 0),
  };
}

export async function createRefreshLog(trigger: "manual" | "scheduled", triggeredBy?: string): Promise<string> {
  // Cierra ejecuciones previas que quedaron colgadas en 'running' (ej. reinicio del contenedor).
  await queryAudit(
    `UPDATE backup_refresh_log SET finished_at = now(), status = 'error',
       details = details || '{"superseded": true}'::jsonb
     WHERE status = 'running'`,
  );
  const res = await queryAudit(
    `INSERT INTO backup_refresh_log (trigger, triggered_by, status) VALUES ($1, $2, 'running') RETURNING id`,
    [trigger, triggeredBy || null],
  );
  return res.rows[0].id;
}

export async function finishRefreshLog(
  id: string,
  status: "success" | "partial" | "error",
  recordsUpserted: number,
  details: unknown,
): Promise<void> {
  await queryAudit(
    `UPDATE backup_refresh_log SET finished_at = now(), status = $2, records_upserted = $3, details = $4 WHERE id = $1`,
    [id, status, recordsUpserted, JSON.stringify(details || {})],
  );
}

export async function getLastRefresh(): Promise<{
  id: string;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  status: string;
  recordsUpserted: number;
  details: Record<string, unknown>;
} | null> {
  const res = await queryAudit(`SELECT * FROM backup_refresh_log ORDER BY started_at DESC LIMIT 1`);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    trigger: row.trigger,
    status: row.status,
    recordsUpserted: row.records_upserted,
    details: row.details || {},
  };
}

export async function getLastSuccessfulRefreshDateBogota(): Promise<string | null> {
  const res = await queryAudit(
    `SELECT started_at FROM backup_refresh_log WHERE status IN ('success', 'partial') ORDER BY started_at DESC LIMIT 1`,
  );
  if (!res.rows[0]) return null;
  const d = new Date(res.rows[0].started_at);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
