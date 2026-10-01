import {
  RDSClient,
  DescribeDBSnapshotsCommand,
  DescribeDBClusterSnapshotsCommand,
} from "@aws-sdk/client-rds";
import { getAWSAccounts } from "@/lib/aws/accounts";
import type { BackupAccountResult } from "./types";

export type NormalizedRdsBackup = {
  provider: "AWS";
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

export const AWS_RDS_IAM_HINT =
  "La credencial AWS necesita los permisos rds:DescribeDBSnapshots y rds:DescribeDBClusterSnapshots " +
  "(recomendado: política administrada AmazonRDSReadOnlyAccess).";

function isAccessError(error: any): boolean {
  const name = error?.name || "";
  const msg = `${error?.message || ""} ${error?.Code || ""}`;
  return (
    name === "AccessDeniedException" ||
    name === "UnauthorizedException" ||
    /not authorized|accessdenied|access denied|forbidden|403/i.test(msg)
  );
}

export async function collectAWSRdsBackups(): Promise<{
  records: NormalizedRdsBackup[];
  accounts: BackupAccountResult[];
}> {
  const accounts = getAWSAccounts();
  const records: NormalizedRdsBackup[] = [];
  const results: BackupAccountResult[] = [];

  for (const account of accounts) {
    const base = {
      provider: "AWS" as const,
      accountId: account.id,
      accountName: account.name,
      region: account.region,
    };
    try {
      const client = new RDSClient({
        region: account.region,
        credentials: { accessKeyId: account.accessKeyId, secretAccessKey: account.secretAccessKey },
      });

      let accountRecords = 0;

      let nextToken: string | undefined;
      do {
        const page = await client.send(
          new DescribeDBSnapshotsCommand({ MaxRecords: 100, Marker: nextToken }),
        );
        for (const snap of page.DBSnapshots || []) {
          records.push({
            ...base,
            dbInstanceId: snap.DBInstanceIdentifier || "",
            dbInstanceName: snap.DBInstanceIdentifier || "",
            engine: snap.Engine || "",
            snapshotId: snap.DBSnapshotIdentifier || "",
            snapshotName: snap.DBSnapshotIdentifier || "",
            snapshotType: snap.SnapshotType || "manual",
            status: (snap.Status || "UNKNOWN").toUpperCase(),
            sizeBytes: snap.AllocatedStorage ? snap.AllocatedStorage * 1024 * 1024 * 1024 : null,
            snapshotCreatedAt: snap.SnapshotCreateTime ? new Date(snap.SnapshotCreateTime).toISOString() : null,
            snapshotCompletedAt: snap.SnapshotCreateTime ? new Date(snap.SnapshotCreateTime).toISOString() : null,
            raw: {
              port: snap.Port || null,
              availabilityZone: snap.AvailabilityZone || null,
              iops: snap.Iops || null,
              storageType: snap.StorageType || null,
              encrypted: snap.Encrypted || false,
              kmsKeyId: snap.KmsKeyId || null,
              licenseModel: snap.LicenseModel || null,
              snapshotDatabaseVersion: null,
            },
          });
          accountRecords++;
        }
        nextToken = page.Marker;
      } while (nextToken);

      let clusterMarker: string | undefined;
      do {
        const clusterPage = await client.send(
          new DescribeDBClusterSnapshotsCommand({ MaxRecords: 100, Marker: clusterMarker }),
        );
        for (const snap of clusterPage.DBClusterSnapshots || []) {
          records.push({
            ...base,
            dbInstanceId: snap.DBClusterIdentifier || "",
            dbInstanceName: snap.DBClusterIdentifier || "",
            engine: snap.Engine || "",
            snapshotId: snap.DBClusterSnapshotIdentifier || "",
            snapshotName: snap.DBClusterSnapshotIdentifier || "",
            snapshotType: snap.SnapshotType || "manual",
            status: (snap.Status || "UNKNOWN").toUpperCase(),
            sizeBytes: snap.AllocatedStorage ? snap.AllocatedStorage * 1024 * 1024 * 1024 : null,
            snapshotCreatedAt: snap.SnapshotCreateTime ? new Date(snap.SnapshotCreateTime).toISOString() : null,
            snapshotCompletedAt: snap.SnapshotCreateTime ? new Date(snap.SnapshotCreateTime).toISOString() : null,
            raw: {
              clusterCreateTime: snap.ClusterCreateTime || null,
              storageEncrypted: snap.StorageEncrypted || false,
              kmsKeyId: snap.KmsKeyId || null,
              engineMode: snap.EngineMode || null,
            },
          });
          accountRecords++;
        }
        clusterMarker = clusterPage.Marker;
      } while (clusterMarker);

      results.push({ ...base, ok: true, vaults: 0, records: accountRecords });
    } catch (error: any) {
      results.push({
        ...base,
        ok: false,
        vaults: 0,
        records: 0,
        error: error?.message || "Error desconocido consultando RDS snapshots",
        permissionHint: isAccessError(error) ? AWS_RDS_IAM_HINT : undefined,
      });
    }
  }

  return { records, accounts: results };
}
