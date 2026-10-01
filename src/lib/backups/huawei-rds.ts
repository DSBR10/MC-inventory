import { huaweiRequest } from "@/lib/huawei/auth";
import { getHuaweiAccounts } from "@/lib/huawei/accounts";
import type { BackupAccountResult } from "./types";

export type NormalizedHuaweiRdsBackup = {
  provider: "HUAWEI CLOUD";
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
};

export const HUAWEI_RDS_IAM_HINT =
  "La credencial Huawei (AK/SK) necesita permisos de consulta sobre RDS en este proyecto " +
  "(recomendado: rol de sistema RDS Administrator).";

function normalizeStatus(status: string): string {
  const s = (status || "").toLowerCase();
  if (["available", "completed", "success"].includes(s)) return "COMPLETED";
  if (["creating", "building", "restoring"].includes(s)) return "IN_PROGRESS";
  if (["failed", "error", "abnormal"].includes(s)) return "FAILED";
  if (["deleting"].includes(s)) return "DELETING";
  return (status || "UNKNOWN").toUpperCase();
}

function parseDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function collectHuaweiRdsBackups(): Promise<{
  records: NormalizedHuaweiRdsBackup[];
  accounts: BackupAccountResult[];
}> {
  const accounts = getHuaweiAccounts();
  const records: NormalizedHuaweiRdsBackup[] = [];
  const results: BackupAccountResult[] = [];

  for (const account of accounts) {
    const base = {
      provider: "HUAWEI CLOUD" as const,
      accountId: account.projectId,
      accountName: account.name,
      region: account.region,
    };
    const host = `rds.${account.region}.myhuaweicloud.com`;
    try {
      let accountRecords = 0;
      const limit = 100;
      let offset = 0;
      let total = Number.MAX_SAFE_INTEGER;

      while (offset < total) {
        const res = await huaweiRequest({
          method: "GET",
          host,
          uri: `/v3/${account.projectId}/backups`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
          query: { limit, offset },
        });
        if (res.status >= 400 || !res.data) {
          throw new Error(
            `RDS backups respondió ${res.status}: ${JSON.stringify(res.data?.error_msg || res.data || {}).slice(0, 300)}`,
          );
        }
        const backups: any[] = res.data.backups || [];
        total = typeof res.data.total === "number" ? res.data.total : backups.length;

        for (const b of backups) {
          records.push({
            ...base,
            dbInstanceId: b.instance_id || "",
            dbInstanceName: b.instance_name || b.instance_id || "",
            engine: b.datastore?.type || "",
            snapshotId: b.id || "",
            snapshotName: b.name || b.id || "",
            snapshotType: b.type || "manual",
            status: normalizeStatus(b.status),
            sizeBytes: b.size !== undefined && b.size !== null ? Number(b.size) * 1024 * 1024 : null,
            snapshotCreatedAt: parseDate(b.begin_time || b.created_at),
            snapshotCompletedAt: parseDate(b.end_time || b.updated_at),
            raw: {
              datastore_version: b.datastore?.version || null,
              databases: b.databases || null,
              backup_strategy: b.backup_strategy || null,
            },
          });
          accountRecords++;
        }
        if (backups.length === 0) break;
        offset += backups.length;
      }

      results.push({ ...base, ok: true, vaults: 0, records: accountRecords });
    } catch (error: any) {
      const msg = error?.message || "Error desconocido consultando RDS backups";
      const access = /401|403|denied|forbidden|unauthorized/i.test(msg);
      results.push({
        ...base,
        ok: false,
        vaults: 0,
        records: 0,
        error: msg,
        permissionHint: access ? HUAWEI_RDS_IAM_HINT : undefined,
      });
    }
  }

  return { records, accounts: results };
}
