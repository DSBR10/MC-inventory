import { huaweiRequest } from "@/lib/huawei/auth";
import { getHuaweiAccounts } from "@/lib/huawei/accounts";
import type { BackupAccountResult, NormalizedBackup } from "./types";

export const HUAWEI_CBR_IAM_HINT =
  "La credencial Huawei (AK/SK) necesita permisos de consulta sobre CBR en este proyecto " +
  "(recomendado: rol de sistema CBR Administrator). Si usas una política personalizada, " +
  "autoriza las acciones de lectura de vaults y backups de Cloud Backup and Recovery.";

const SERVER_RESOURCE_TYPES = new Set(["OS::Nova::Server", "OS::Cinder::Volume"]);

function normalizeStatus(status: string): string {
  const s = (status || "").toLowerCase();
  if (["available", "completed"].includes(s)) return "COMPLETED";
  if (["protecting", "creating", "restoring", "replicating"].includes(s)) return "IN_PROGRESS";
  if (["error", "failed"].includes(s)) return "FAILED";
  if (["deleting"].includes(s)) return "DELETING";
  if (["expired"].includes(s)) return "EXPIRED";
  return (status || "UNKNOWN").toUpperCase();
}

// CBR devuelve "2024-05-01 10:00:00" (UTC). Se normaliza a ISO con Z.
function parseCbrDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function collectHuaweiBackups(): Promise<{ records: NormalizedBackup[]; accounts: BackupAccountResult[] }> {
  const accounts = getHuaweiAccounts();
  const records: NormalizedBackup[] = [];
  const results: BackupAccountResult[] = [];

  for (const account of accounts) {
    const base = {
      provider: "HUAWEI CLOUD" as const,
      accountId: account.projectId,
      accountName: account.name,
      region: account.region,
    };
    const host = `cbr.${account.region}.myhuaweicloud.com`;
    try {
      const vaultsRes = await huaweiRequest({ method: "GET", host, uri: `/v3/${account.projectId}/vaults`, ak: account.ak, sk: account.sk, projectId: account.projectId });
      if (vaultsRes.status >= 400 || !vaultsRes.data) {
        throw new Error(
          `CBR vaults respondió ${vaultsRes.status}: ${JSON.stringify(vaultsRes.data?.error_msg || vaultsRes.data || {}).slice(0, 300)}`,
        );
      }
      const vaults: any[] = vaultsRes.data.vaults || [];
      const vaultNameById = new Map(vaults.map((v) => [v.id, v.name || v.id]));

      let accountRecords = 0;
      const limit = 100;
      let offset = 0;
      let total = Number.MAX_SAFE_INTEGER;
      while (offset < total) {
        const backupsRes = await huaweiRequest({
          method: "GET",
          host,
          uri: `/v3/${account.projectId}/backups`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
          query: { limit, offset },
        });
        if (backupsRes.status >= 400 || !backupsRes.data) {
          throw new Error(
            `CBR backups respondió ${backupsRes.status}: ${JSON.stringify(backupsRes.data?.error_msg || backupsRes.data || {}).slice(0, 300)}`,
          );
        }
        const backups: any[] = backupsRes.data.backups || [];
        total = typeof backupsRes.data.count === "number" ? backupsRes.data.count : backups.length;
        for (const b of backups) {
          if (b.resource_type && !SERVER_RESOURCE_TYPES.has(b.resource_type)) continue;
          records.push({
            ...base,
            vaultId: b.vault_id || "",
            vaultName: vaultNameById.get(b.vault_id) || b.vault_id || "",
            backupId: b.id || "",
            backupName: b.name || b.id || "",
            resourceId: b.resource_id || "",
            resourceName: b.resource_name || "",
            resourceType: b.resource_type || "",
            status: normalizeStatus(b.status),
            sizeBytes: b.size !== undefined && b.size !== null ? Number(b.size) : null,
            backupCreatedAt: parseCbrDate(b.created_at),
            backupCompletedAt: parseCbrDate(b.completed_at || b.updated_at),
            backupExpiresAt: parseCbrDate(b.expired_at),
            raw: {
              parent_id: b.parent_id || null,
              protect_type: b.protect_type || null,
              checkpoint_id: b.checkpoint_id || null,
              resource_az: b.resource_az || null,
              enterprise_project_id: b.enterprise_project_id || null,
            },
          });
          accountRecords++;
        }
        if (backups.length === 0) break;
        offset += backups.length;
      }

      results.push({ ...base, ok: true, vaults: vaults.length, records: accountRecords });
    } catch (error: any) {
      const msg = error?.message || "Error desconocido consultando CBR";
      const access = /401|403|denied|forbidden|unauthorized/i.test(msg);
      results.push({
        ...base,
        ok: false,
        vaults: 0,
        records: 0,
        error: msg,
        permissionHint: access ? HUAWEI_CBR_IAM_HINT : undefined,
      });
    }
  }

  return { records, accounts: results };
}
