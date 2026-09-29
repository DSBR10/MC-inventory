import {
  BackupClient,
  ListBackupVaultsCommand,
  ListRecoveryPointsByBackupVaultCommand,
} from "@aws-sdk/client-backup";
import { getAWSAccounts } from "@/lib/aws/accounts";
import type { BackupAccountResult, NormalizedBackup } from "./types";

export const AWS_BACKUP_IAM_HINT =
  "La credencial AWS necesita los permisos backup:ListBackupVaults y backup:ListRecoveryPointsByBackupVault " +
  "(recomendado: política administrada AWSBackupOperatorAccess o una política propia de solo lectura).";

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

      const vaultsRes = await client.send(new ListBackupVaultsCommand({}));
      const vaults = vaultsRes.BackupVaultList || [];
      let accountRecords = 0;

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
