import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-rds";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

const ENABLE_TAGS = process.env.ENABLE_RDS_TAGS === "true";

export async function getAWSDocumentDBInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new RDSClient({
      region,
      credentials,
    });

    const inventory: any[] = [];

    // Describe DocumentDB Clusters (Instance-less cluster level)
    try {
      const clustersData = await client.send(
        new DescribeDBClustersCommand({
          Filters: [
            {
              Name: "engine",
              Values: ["docdb"],
            },
          ],
        }),
      );

      for (const cluster of clustersData.DBClusters || []) {
        let tags: Record<string, string> = {};

        if (ENABLE_TAGS && cluster.DBClusterArn) {
          try {
            const tagData = await client.send(
              new ListTagsForResourceCommand({
                ResourceName: cluster.DBClusterArn,
              }),
            );
            tags = formatAwsTags(tagData.TagList || []);
          } catch (err) {
            console.error(
              `DocumentDB cluster tags error for ${cluster.DBClusterIdentifier}:`,
              err,
            );
          }
        }

        inventory.push({
          uniqueKey: `AWS-${account.id}-DOCDB-CLUSTER-${cluster.DBClusterIdentifier}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "DocumentDB",
          name: cluster.DBClusterIdentifier || "N/A",
          id: cluster.DBClusterResourceId || "N/A",
          host: cluster.Endpoint || "N/A",
          status: cluster.Status || "UNKNOWN",
          operatingSystem: cluster.Engine || "docdb",
          platform: cluster.EngineVersion || "N/A",
          architecture: cluster.StorageEncrypted ? "Encrypted" : "Unencrypted",
          instanceType: cluster.DBSubnetGroup || "N/A",
          availabilityZone: cluster.AvailabilityZones?.join(", ") || region,
          tags,
          raw: {
            arn: cluster.DBClusterArn,
            readerEndpoint: cluster.ReaderEndpoint,
            port: cluster.Port,
            masterUsername: cluster.MasterUsername,
            backupRetentionPeriod: cluster.BackupRetentionPeriod,
            preferredBackupWindow: cluster.PreferredBackupWindow,
            preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
            multiAz: cluster.MultiAZ,
            storageEncrypted: cluster.StorageEncrypted,
            kmsKeyId: cluster.KmsKeyId,
            dbClusterParameterGroup: cluster.DBClusterParameterGroup,
            vpcSecurityGroups: cluster.VpcSecurityGroups,
            associatedRoles: cluster.AssociatedRoles,
            clonedFromClusterIdentifier: cluster.ClonedFromAccount,
            tagsSource: cluster.TagList,
          },
        });
      }
    } catch (err) {
      console.error("DocumentDB Clusters error:", err);
    }

    // Describe DocumentDB Instances
    try {
      const instancesData = await client.send(
        new DescribeDBInstancesCommand({
          Filters: [
            {
              Name: "engine",
              Values: ["docdb"],
            },
          ],
        }),
      );

      for (const instance of instancesData.DBInstances || []) {
        let tags: Record<string, string> = {};

        if (ENABLE_TAGS && instance.DBInstanceArn) {
          try {
            const tagData = await client.send(
              new ListTagsForResourceCommand({
                ResourceName: instance.DBInstanceArn,
              }),
            );
            tags = formatAwsTags(tagData.TagList || []);
          } catch (err) {
            console.error(
              `DocumentDB instance tags error for ${instance.DBInstanceIdentifier}:`,
              err,
            );
          }
        }

        inventory.push({
          uniqueKey: `AWS-${account.id}-DOCDB-${instance.DBInstanceIdentifier}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "DocumentDB",
          name: instance.DBInstanceIdentifier || "N/A",
          id: instance.DbiResourceId || "N/A",
          host: instance.Endpoint?.Address || "N/A",
          status: instance.DBInstanceStatus || "UNKNOWN",
          operatingSystem: instance.Engine || "docdb",
          platform: instance.EngineVersion || "N/A",
          architecture: instance.StorageEncrypted ? "Encrypted" : "Unencrypted",
          instanceType: instance.DBInstanceClass || "N/A",
          availabilityZone: instance.AvailabilityZone || "N/A",
          tags,
          raw: {
            arn: instance.DBInstanceArn,
            endpoint: instance.Endpoint,
            preferredBackupWindow: instance.PreferredBackupWindow,
            preferredMaintenanceWindow: instance.PreferredMaintenanceWindow,
            publiclyAccessible: instance.PubliclyAccessible,
            vpcSecurityGroups: instance.VpcSecurityGroups,
            dbSubnetGroup: instance.DBSubnetGroup,
            kmsKeyId: instance.KmsKeyId,
          },
        });
      }
    } catch (err) {
      console.error("DocumentDB Instances error:", err);
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS DocumentDB ERROR:", error?.message || error);
    return [];
  }
}
