// Tipos del módulo Backups (AWS Backup + Huawei CBR).

export type BackupProvider = "AWS" | "HUAWEI CLOUD";

export type BackupRecord = {
  id: string;
  provider: BackupProvider;
  accountId: string;
  accountName: string;
  region: string;
  vaultId: string;
  vaultName: string;
  backupId: string;
  backupName: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  status: string;
  sizeBytes: number | null;
  backupCreatedAt: string | null;
  backupCompletedAt: string | null;
  backupExpiresAt: string | null;
  raw: Record<string, unknown>;
  collectedAt: string;
};

export type BackupAccountResult = {
  provider: BackupProvider;
  accountId: string;
  accountName: string;
  region: string;
  ok: boolean;
  vaults: number;
  records: number;
  error?: string;
  permissionHint?: string;
};

export type BackupRefreshSummary = {
  logId: string;
  trigger: "manual" | "scheduled";
  status: "success" | "partial" | "error";
  recordsUpserted: number;
  accounts: BackupAccountResult[];
  startedAt: string;
  finishedAt: string;
};

// Registro normalizado previo a persistir (sin id/collect).
export type NormalizedBackup = {
  provider: BackupProvider;
  accountId: string;
  accountName: string;
  region: string;
  vaultId: string;
  vaultName: string;
  backupId: string;
  backupName: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  status: string;
  sizeBytes: number | null;
  backupCreatedAt: string | null;
  backupCompletedAt: string | null;
  backupExpiresAt: string | null;
  raw: Record<string, unknown>;
};
