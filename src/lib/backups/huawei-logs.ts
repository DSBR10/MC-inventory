import ObsClient from "esdk-obs-nodejs";
import { getHuaweiAccounts } from "@/lib/huawei/accounts";
import type { BackupAccountResult } from "./types";
import type { NormalizedLogBackup } from "./aws-logs";
import { getYesterdayBogotaDate } from "./date-utils";

export const HUAWEI_OBS_LOGS_HINT =
  "La credencial Huawei (AK/SK) necesita permisos de listado sobre el bucket OBS ux-backup " +
  "(recomendado: rol de sistema OBS OperateAccess + OBS BucketListAccess).";

export async function collectHuaweiLogBackups(): Promise<{
  records: NormalizedLogBackup[];
  accounts: BackupAccountResult[];
}> {
  const accounts = getHuaweiAccounts();
  const records: NormalizedLogBackup[] = [];
  const results: BackupAccountResult[] = [];
  const backupDate = getYesterdayBogotaDate();
  const BUCKET_NAME = "ux-backup";

  // Solo la cuenta acc_ux tiene backups de logs en OBS
  const LOG_ACCOUNT_NAME = "acc_ux";

  for (const account of accounts) {
    const base = {
      provider: "HUAWEI CLOUD" as const,
      accountId: account.projectId,
      accountName: account.name,
      region: account.region,
    };

    // Excluir todas las cuentas excepto acc_ux
    if (account.name !== LOG_ACCOUNT_NAME) {
      continue;
    }

    try {
      const obsClient = new ObsClient({
        access_key_id: account.ak,
        secret_access_key: account.sk,
        server: `https://obs.${account.region}.myhuaweicloud.com`,
      });

      const prefix = `${backupDate}/`;
      let accountRecords = 0;

      const serverFolders = new Map<string, number>();
      let isTopTruncated = true;
      let topMarker: string | undefined;

      while (isTopTruncated) {
        const listResult = await obsClient.listObjects({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          Delimiter: "/",
          MaxKeys: 1000,
          Marker: topMarker || "",
        });

        const commonPrefixes = listResult?.InterfaceResult?.CommonPrefixes || [];

        for (const item of commonPrefixes) {
          const folderPrefix = item.Prefix || "";
          const parts = folderPrefix.replace(prefix, "").split("/");
          const serverName = parts[0];
          if (!serverName) continue;

          const serverPrefix = `${prefix}${serverName}/`;
          let serverSize = 0;
          let isTruncated = true;
          let marker: string | undefined;

          while (isTruncated) {
            const objResult = await obsClient.listObjects({
              Bucket: BUCKET_NAME,
              Prefix: serverPrefix,
              MaxKeys: 1000,
              Marker: marker || "",
            });
            const contents = objResult?.InterfaceResult?.Contents || [];
            for (const obj of contents) {
              serverSize += Number(obj.Size) || 0;
            }
            isTruncated = objResult?.InterfaceResult?.IsTruncated === "true";
            marker = objResult?.InterfaceResult?.NextMarker;
          }

          serverFolders.set(serverName, serverSize);
        }

        isTopTruncated = listResult?.InterfaceResult?.IsTruncated === "true";
        topMarker = listResult?.InterfaceResult?.NextMarker;
      }

      if (serverFolders.size === 0) {
        records.push({
          ...base,
          bucketName: BUCKET_NAME,
          backupDate,
          serverName: "(sin carpetas)",
          folderExists: false,
          sizeBytes: 0,
          status: "NO_BACKUP",
          raw: { prefix, note: "No se encontraron carpetas de servidor para esta fecha" },
        });
        accountRecords++;
      } else {
        for (const [serverName, sizeBytes] of serverFolders) {
          const hasContent = sizeBytes > 0;
          records.push({
            ...base,
            bucketName: BUCKET_NAME,
            backupDate,
            serverName,
            folderExists: true,
            sizeBytes,
            status: hasContent ? "COMPLETED" : "EMPTY",
            raw: { prefix: `${prefix}${serverName}/`, sizeBytes },
          });
          accountRecords++;
        }
      }

      results.push({ ...base, ok: true, vaults: 0, records: accountRecords });
    } catch (error: any) {
      const msg = error?.message || "Error desconocido consultando OBS logs";
      const access = /401|403|denied|forbidden|unauthorized|AccessDenied/i.test(msg);
      results.push({
        ...base,
        ok: false,
        vaults: 0,
        records: 0,
        error: msg,
        permissionHint: access ? HUAWEI_OBS_LOGS_HINT : undefined,
      });
    }
  }

  return { records, accounts: results };
}
