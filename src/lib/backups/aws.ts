import {
  BackupClient,
  ListBackupVaultsCommand,
  ListRecoveryPointsByBackupVaultCommand,
} from "@aws-sdk/client-backup";
import {
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import { getAWSAccounts, type AWSAccount } from "@/lib/aws/accounts";
import type { BackupAccountResult, NormalizedBackup } from "./types";

export const AWS_BACKUP_IAM_HINT =
  "La credencial AWS necesita los permisos backup:ListBackupVaults y backup:ListRecoveryPointsByBackupVault " +
  "(recomendado: política administrada AWSBackupOperatorAccess o una política propia de solo lectura). " +
  "Para mostrar el nombre de los servidores además del ID, agrega ec2:DescribeInstances y ec2:DescribeVolumes (solo lectura).";

const SERVER_RESOURCE_TYPES = new Set(["EC2", "EBS"]);

function parseResourceId(arn: string): string {
  if (!arn) return "";
  const slash = arn.split("/");
  if (slash.length > 1) return slash[slash.length - 1];
  const colon = arn.split(":");
  return colon[colon.length - 1] || arn;
}

function isAccessError(error: any): boolean {
  const name = error?.name || "";
  const msg = `${error?.message || ""} ${error?.Code || ""}`;
  return (
    name === "AccessDeniedException" ||
    name === "UnauthorizedException" ||
    /not authorized|accessdenied|access denied|forbidden|403/i.test(msg)
  );
}

type Ec2NameInfo = {
  name: string;
  instanceType?: string;
  state?: string;
  privateIp?: string;
  volumeType?: string;
  volumeSize?: number;
};

function tagName(tags?: Array<{ Key?: string; Value?: string }>): string {
  return tags?.find((t) => t.Key === "Name")?.Value?.trim() || "";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Resuelve el tag Name de instancias EC2 y volúmenes EBS para mostrar
// el nombre del servidor en vez del ID. No lanza: si falla (p. ej. sin
// permiso ec2:DescribeInstances), se conservan los IDs y se avisa en log.
async function resolveEc2Names(
  account: AWSAccount,
  instanceIds: string[],
  volumeIds: string[],
): Promise<Map<string, Ec2NameInfo>> {
  const map = new Map<string, Ec2NameInfo>();
  if (instanceIds.length === 0 && volumeIds.length === 0) return map;

  const client = new EC2Client({
    region: account.region,
    credentials: { accessKeyId: account.accessKeyId, secretAccessKey: account.secretAccessKey },
  });

  // Instancias en lotes; si un lote trae IDs inexistentes (terminadas),
  // se reintenta una por una ignorando las ausentes.
  for (const ids of chunk([...new Set(instanceIds)], 200)) {
    try {
      let nextToken: string | undefined;
      do {
        const page = await client.send(new DescribeInstancesCommand({ InstanceIds: ids, NextToken: nextToken }));
        for (const reservation of page.Reservations || []) {
          for (const inst of reservation.Instances || []) {
            if (!inst.InstanceId) continue;
            map.set(inst.InstanceId, {
              name: tagName(inst.Tags),
              instanceType: inst.InstanceType || undefined,
              state: inst.State?.Name || undefined,
              privateIp: inst.PrivateIpAddress || undefined,
            });
          }
        }
        nextToken = page.NextToken;
      } while (nextToken);
    } catch (error: any) {
      if (error?.name === "InvalidInstanceID.NotFound" || /not exist|not found/i.test(error?.message || "")) {
        for (const id of ids) {
          try {
            const single = await client.send(new DescribeInstancesCommand({ InstanceIds: [id] }));
            const inst = single.Reservations?.[0]?.Instances?.[0];
            if (inst?.InstanceId) {
              map.set(inst.InstanceId, {
                name: tagName(inst.Tags),
                instanceType: inst.InstanceType || undefined,
                state: inst.State?.Name || undefined,
                privateIp: inst.PrivateIpAddress || undefined,
              });
            }
          } catch {
            // Instancia terminada o inaccesible: se conserva el ID.
          }
        }
      } else {
        console.warn(`[backups] no se pudieron resolver nombres EC2 en ${account.name}:`, error?.message || error);
        if (isAccessError(error)) {
          console.warn(`[backups] falta ec2:DescribeInstances en ${account.name}; se mostrarán IDs.`);
        }
        return map;
      }
    }
  }

  for (const ids of chunk([...new Set(volumeIds)], 200)) {
    try {
      let nextToken: string | undefined;
      do {
        const page = await client.send(new DescribeVolumesCommand({ VolumeIds: ids, NextToken: nextToken }));
        for (const vol of page.Volumes || []) {
          if (!vol.VolumeId) continue;
          map.set(vol.VolumeId, {
            name: tagName(vol.Tags),
            volumeType: vol.VolumeType || undefined,
            volumeSize: vol.Size ?? undefined,
            state: vol.State || undefined,
          });
        }
        nextToken = page.NextToken;
      } while (nextToken);
    } catch (error: any) {
      if (error?.name === "InvalidVolume.NotFound" || /not exist|not found/i.test(error?.message || "")) {
        for (const id of ids) {
          try {
            const single = await client.send(new DescribeVolumesCommand({ VolumeIds: [id] }));
            const vol = single.Volumes?.[0];
            if (vol?.VolumeId) {
              map.set(vol.VolumeId, {
                name: tagName(vol.Tags),
                volumeType: vol.VolumeType || undefined,
                volumeSize: vol.Size ?? undefined,
                state: vol.State || undefined,
              });
            }
          } catch {
            // Volumen eliminado: se conserva el ID.
          }
        }
      } else {
        console.warn(`[backups] no se pudieron resolver nombres EBS en ${account.name}:`, error?.message || error);
        return map;
      }
    }
  }

  return map;
}

export async function collectAWSBackups(): Promise<{ records: NormalizedBackup[]; accounts: BackupAccountResult[] }> {
  const accounts = getAWSAccounts();
  const records: NormalizedBackup[] = [];
  const results: BackupAccountResult[] = [];

  for (const account of accounts) {
    const base = {
      provider: "AWS" as const,
      accountId: account.id,
      accountName: account.name,
      region: account.region,
    };
    try {
      const client = new BackupClient({
        region: account.region,
        credentials: { accessKeyId: account.accessKeyId, secretAccessKey: account.secretAccessKey },
      });

      let vaultNextToken: string | undefined;
      const vaults: any[] = [];
      do {
        const vaultsPage = await client.send(new ListBackupVaultsCommand({ MaxResults: 100, NextToken: vaultNextToken }));
        vaults.push(...(vaultsPage.BackupVaultList || []));
        vaultNextToken = vaultsPage.NextToken;
      } while (vaultNextToken);

      let accountRecords = 0;
      const accountStartIndex = records.length;

      for (const vault of vaults) {
        const vaultName = vault.BackupVaultName || "";
        let nextToken: string | undefined;
        do {
          const page = await client.send(
            new ListRecoveryPointsByBackupVaultCommand({ BackupVaultName: vaultName, MaxResults: 100, NextToken: nextToken }),
          );
          for (const rp of page.RecoveryPoints || []) {
            if (rp.ResourceType && !SERVER_RESOURCE_TYPES.has(rp.ResourceType)) continue;
            const resourceArn = rp.ResourceArn || "";
            records.push({
              ...base,
              vaultId: rp.BackupVaultArn || "",
              vaultName: rp.BackupVaultName || vaultName,
              backupId: rp.RecoveryPointArn || "",
              backupName: rp.RecoveryPointArn?.split(":").pop() || "",
              resourceId: parseResourceId(resourceArn),
              resourceName: "",
              resourceType: rp.ResourceType || "",
              status: (rp.Status || "UNKNOWN").toUpperCase(),
              sizeBytes: rp.BackupSizeInBytes !== undefined && rp.BackupSizeInBytes !== null ? Number(rp.BackupSizeInBytes) : null,
              backupCreatedAt: rp.CreationDate ? new Date(rp.CreationDate).toISOString() : null,
              backupCompletedAt: rp.CompletionDate ? new Date(rp.CompletionDate).toISOString() : null,
              backupExpiresAt: (rp as any).ExpirationDate ? new Date((rp as any).ExpirationDate).toISOString() : null,
              raw: {
                resourceArn,
                iamRoleArn: rp.IamRoleArn || null,
                createdBy: rp.CreatedBy || null,
                statusMessage: (rp as any).StatusMessage || null,
                encryptionKeyArn: (rp as any).EncryptionKeyArn || null,
              },
            });
            accountRecords++;
          }
          nextToken = page.NextToken;
        } while (nextToken);
      }

      // Enriquece con el nombre (tag Name) de cada servidor/volumen para el informe.
      const accountRecordsSlice = records.slice(accountStartIndex);
      const instanceIds = accountRecordsSlice
        .filter((r) => r.resourceType === "EC2" && /^i-[0-9a-f]+$/i.test(r.resourceId))
        .map((r) => r.resourceId);
      const volumeIds = accountRecordsSlice
        .filter((r) => r.resourceType === "EBS" && /^vol-[0-9a-f]+$/i.test(r.resourceId))
        .map((r) => r.resourceId);
      const names = await resolveEc2Names(account, instanceIds, volumeIds);
      for (const record of accountRecordsSlice) {
        const info = names.get(record.resourceId);
        if (!info) continue;
        if (info.name) record.resourceName = info.name;
        record.raw = {
          ...record.raw,
          instanceName: info.name || null,
          instanceType: info.instanceType || null,
          state: info.state || null,
          privateIp: info.privateIp || null,
          volumeType: info.volumeType || null,
          volumeSizeGiB: info.volumeSize ?? null,
        };
      }

      results.push({ ...base, ok: true, vaults: vaults.length, records: accountRecords });
    } catch (error: any) {
      results.push({
        ...base,
        ok: false,
        vaults: 0,
        records: 0,
        error: error?.message || "Error desconocido consultando AWS Backup",
        permissionHint: isAccessError(error) ? AWS_BACKUP_IAM_HINT : undefined,
      });
    }
  }

  return { records, accounts: results };
}
