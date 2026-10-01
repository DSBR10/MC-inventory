import { queryAudit } from "@/lib/db/pool";

// ── RDS Backups ──

export type RdsBackupRecord = {
  id: string;
  provider: "AWS" | "HUAWEI CLOUD";
  accountId: string;
  accountName: string;
  region: string;
  dbInstanceId: string;
  dbInstanceName: string;
  engine: string;
  snapshotId: string;
  snapshotName: string;
  snapshotType: string;
  status: string;
  sizeBytes: number | null;
  snapshotCreatedAt: string | null;
  snapshotCompletedAt: string | null;
  raw: Record<string, unknown>;
  collectedAt: string;
};

function toRdsRecord(row: any): RdsBackupRecord {
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.account_id,
    accountName: row.account_name,
    region: row.region,
    dbInstanceId: row.db_instance_id,
    dbInstanceName: row.db_instance_name,
    engine: row.engine,
    snapshotId: row.snapshot_id,
    snapshotName: row.snapshot_name,
    snapshotType: row.snapshot_type,
    status: row.status,
    sizeBytes: row.size_bytes !== null && row.size_bytes !== undefined ? Number(row.size_bytes) : null,
    snapshotCreatedAt: row.snapshot_created_at ? new Date(row.snapshot_created_at).toISOString() : null,
    snapshotCompletedAt: row.snapshot_completed_at ? new Date(row.snapshot_completed_at).toISOString() : null,
    raw: row.raw || {},
    collectedAt: row.collected_at ? new Date(row.collected_at).toISOString() : "",
  };
}

export async function upsertRdsBackups(records: any[]): Promise<number> {
  if (records.length === 0) return 0;
  const CHUNK = 500;
  let total = 0;
  for (let start = 0; start < records.length; start += CHUNK) {
    const chunk = records.slice(start, start + CHUNK);
    const values: unknown[] = [];
    const rows = chunk.map((r, i) => {
      const o = i * 14;
      values.push(
        r.provider, r.accountId, r.accountName, r.region,
        r.dbInstanceId, r.dbInstanceName, r.engine,
        r.snapshotId, r.snapshotName, r.snapshotType, r.status,
        r.sizeBytes, r.snapshotCreatedAt, r.snapshotCompletedAt,
      );
      const ph = Array.from({ length: 14 }, (_, k) => `$${o + k + 1}`).join(", ");
      return `(${ph})`;
    });
    const res = await queryAudit(
      `INSERT INTO rds_backups
        (provider, account_id, account_name, region, db_instance_id, db_instance_name, engine,
         snapshot_id, snapshot_name, snapshot_type, status, size_bytes, snapshot_created_at, snapshot_completed_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (provider, account_id, snapshot_id) DO UPDATE SET
         account_name = EXCLUDED.account_name,
         region = EXCLUDED.region,
         db_instance_id = EXCLUDED.db_instance_id,
         db_instance_name = EXCLUDED.db_instance_name,
         engine = EXCLUDED.engine,
         snapshot_name = EXCLUDED.snapshot_name,
         snapshot_type = EXCLUDED.snapshot_type,
         status = EXCLUDED.status,
         size_bytes = EXCLUDED.size_bytes,
         snapshot_created_at = EXCLUDED.snapshot_created_at,
         snapshot_completed_at = EXCLUDED.snapshot_completed_at,
         collected_at = now()`,
      values,
    );
    total += res.rowCount || 0;
  }
  return total;
}

export type RdsBackupFilters = {
  provider?: string;
  accountId?: string;
  status?: string;
  engine?: string;
  snapshotType?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function listRdsBackups(filters: RdsBackupFilters): Promise<{ records: RdsBackupRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (filters.provider) { conditions.push(`provider = $${i++}`); values.push(filters.provider); }
  if (filters.accountId) { conditions.push(`account_id = $${i++}`); values.push(filters.accountId); }
  if (filters.status) { conditions.push(`status = $${i++}`); values.push(filters.status); }
  if (filters.engine) { conditions.push(`engine = $${i++}`); values.push(filters.engine); }
  if (filters.snapshotType) { conditions.push(`snapshot_type = $${i++}`); values.push(filters.snapshotType); }
  if (filters.from) { conditions.push(`snapshot_created_at >= $${i++}`); values.push(filters.from); }
  if (filters.to) { conditions.push(`snapshot_created_at <= $${i++}`); values.push(filters.to); }
  if (filters.search) {
    conditions.push(`(snapshot_name ILIKE $${i} OR db_instance_name ILIKE $${i} OR snapshot_id ILIKE $${i} OR db_instance_id ILIKE $${i})`);
    values.push(`%${filters.search}%`);
    i++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;

  const [countRes, rowsRes] = await Promise.all([
    queryAudit(`SELECT COUNT(*)::int AS total FROM rds_backups ${where}`, values),
    queryAudit(
      `SELECT * FROM rds_backups ${where} ORDER BY snapshot_created_at DESC NULLS LAST, collected_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, pageSize, offset],
    ),
  ]);

  return { records: rowsRes.rows.map(toRdsRecord), total: countRes.rows[0]?.total || 0 };
}

export async function getRdsBackupSummary(): Promise<{
  total: number;
  byProvider: Array<{ provider: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byAccount: Array<{ provider: string; accountId: string; accountName: string; total: number; lastBackup: string | null }>;
  byEngine: Array<{ engine: string; total: number }>;
  totalBytes: number;
}> {
  const [totalRes, providerRes, statusRes, accountRes, engineRes, bytesRes] = await Promise.all([
    queryAudit<{ total: number }>(`SELECT COUNT(*)::int AS total FROM rds_backups`),
    queryAudit<{ provider: string; total: number }>(`SELECT provider, COUNT(*)::int AS total FROM rds_backups GROUP BY provider ORDER BY total DESC`),
    queryAudit<{ status: string; total: number }>(`SELECT status, COUNT(*)::int AS total FROM rds_backups GROUP BY status ORDER BY total DESC`),
    queryAudit<{ provider: string; accountId: string; accountName: string; total: number; lastBackup: Date | string | null }>(`SELECT provider, account_id AS "accountId", account_name AS "accountName", COUNT(*)::int AS total, MAX(snapshot_created_at) AS "lastBackup" FROM rds_backups GROUP BY provider, account_id, account_name ORDER BY total DESC`),
    queryAudit<{ engine: string; total: number }>(`SELECT engine, COUNT(*)::int AS total FROM rds_backups GROUP BY engine ORDER BY total DESC`),
    queryAudit<{ bytes: string }>(`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes FROM rds_backups`),
  ]);
  return {
    total: totalRes.rows[0]?.total || 0,
    byProvider: providerRes.rows,
    byStatus: statusRes.rows,
    byAccount: accountRes.rows.map((r) => ({ ...r, lastBackup: r.lastBackup ? new Date(r.lastBackup).toISOString() : null })),
    byEngine: engineRes.rows,
    totalBytes: Number(bytesRes.rows[0]?.bytes || 0),
  };
}

// ── Log Backups ──

export type LogBackupRecord = {
  id: string;
  provider: "AWS" | "HUAWEI CLOUD";
  accountId: string;
  accountName: string;
  region: string;
  bucketName: string;
  backupDate: string;
  serverName: string;
  folderExists: boolean;
  sizeBytes: number;
  status: string;
  raw: Record<string, unknown>;
  collectedAt: string;
};

function toLogRecord(row: any): LogBackupRecord {
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.account_id,
    accountName: row.account_name,
    region: row.region,
    bucketName: row.bucket_name,
    backupDate: row.backup_date,
    serverName: row.server_name,
    folderExists: row.folder_exists,
    sizeBytes: Number(row.size_bytes || 0),
    status: row.status,
    raw: row.raw || {},
    collectedAt: row.collected_at ? new Date(row.collected_at).toISOString() : "",
  };
}

export async function upsertLogBackups(records: any[]): Promise<number> {
  if (records.length === 0) return 0;
  const CHUNK = 500;
  let total = 0;
  for (let start = 0; start < records.length; start += CHUNK) {
    const chunk = records.slice(start, start + CHUNK);
    const values: unknown[] = [];
    const rows = chunk.map((r: any, i: number) => {
      const o = i * 10;
      values.push(
        r.provider, r.accountId, r.accountName, r.region,
        r.bucketName, r.backupDate, r.serverName,
        r.folderExists, r.sizeBytes, r.status,
      );
      const ph = Array.from({ length: 10 }, (_, k) => `$${o + k + 1}`).join(", ");
      return `(${ph})`;
    });
    const res = await queryAudit(
      `INSERT INTO log_backups
        (provider, account_id, account_name, region, bucket_name, backup_date, server_name, folder_exists, size_bytes, status)
       VALUES ${rows.join(", ")}
       ON CONFLICT (provider, account_id, bucket_name, backup_date, server_name) DO UPDATE SET
         account_name = EXCLUDED.account_name,
         region = EXCLUDED.region,
         folder_exists = EXCLUDED.folder_exists,
         size_bytes = EXCLUDED.size_bytes,
         status = EXCLUDED.status,
         collected_at = now()`,
      values,
    );
    total += res.rowCount || 0;
  }
  return total;
}

export type LogBackupFilters = {
  provider?: string;
  accountId?: string;
  status?: string;
  backupDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listLogBackups(filters: LogBackupFilters): Promise<{ records: LogBackupRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (filters.provider) { conditions.push(`provider = $${i++}`); values.push(filters.provider); }
  if (filters.accountId) { conditions.push(`account_id = $${i++}`); values.push(filters.accountId); }
  if (filters.status) { conditions.push(`status = $${i++}`); values.push(filters.status); }
  if (filters.backupDate) { conditions.push(`backup_date = $${i++}`); values.push(filters.backupDate); }
  if (filters.search) {
    conditions.push(`(server_name ILIKE $${i} OR bucket_name ILIKE $${i} OR account_name ILIKE $${i})`);
    values.push(`%${filters.search}%`);
    i++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;

  const [countRes, rowsRes] = await Promise.all([
    queryAudit(`SELECT COUNT(*)::int AS total FROM log_backups ${where}`, values),
    queryAudit(
      `SELECT * FROM log_backups ${where} ORDER BY backup_date DESC, server_name ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, pageSize, offset],
    ),
  ]);

  return { records: rowsRes.rows.map(toLogRecord), total: countRes.rows[0]?.total || 0 };
}

export async function getLogBackupSummary(): Promise<{
  total: number;
  byProvider: Array<{ provider: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byAccount: Array<{ provider: string; accountId: string; accountName: string; total: number }>;
  byDate: Array<{ backupDate: string; total: number }>;
  totalBytes: number;
}> {
  const [totalRes, providerRes, statusRes, accountRes, dateRes, bytesRes] = await Promise.all([
    queryAudit<{ total: number }>(`SELECT COUNT(*)::int AS total FROM log_backups`),
    queryAudit<{ provider: string; total: number }>(`SELECT provider, COUNT(*)::int AS total FROM log_backups GROUP BY provider ORDER BY total DESC`),
    queryAudit<{ status: string; total: number }>(`SELECT status, COUNT(*)::int AS total FROM log_backups GROUP BY status ORDER BY total DESC`),
    queryAudit<{ provider: string; accountId: string; accountName: string; total: number }>(`SELECT provider, account_id AS "accountId", account_name AS "accountName", COUNT(*)::int AS total FROM log_backups GROUP BY provider, account_id, account_name ORDER BY total DESC`),
    queryAudit<{ backupDate: string; total: number }>(`SELECT backup_date AS "backupDate", COUNT(*)::int AS total FROM log_backups GROUP BY backup_date ORDER BY backup_date DESC LIMIT 30`),
    queryAudit<{ bytes: string }>(`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes FROM log_backups`),
  ]);
  return {
    total: totalRes.rows[0]?.total || 0,
    byProvider: providerRes.rows,
    byStatus: statusRes.rows,
    byAccount: accountRes.rows,
    byDate: dateRes.rows,
    totalBytes: Number(bytesRes.rows[0]?.bytes || 0),
  };
}
