import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  DescribeCacheSubnetGroupsCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-elasticache";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

export async function getAWSElastiCacheInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new ElastiCacheClient({
      region,
      credentials,
    });

    const inventory: any[] = [];

    // Describe Cache Clusters
    const clustersData = await client.send(
      new DescribeCacheClustersCommand({}),
    );

    for (const cluster of clustersData.CacheClusters || []) {
      let tags: Record<string, string> = {};

      try {
        if (cluster.ARN) {
          const tagsData = await client.send(
            new ListTagsForResourceCommand({
              ResourceName: cluster.ARN,
            }),
          );
          tags = formatAwsTags(tagsData.TagList || []);
        }
      } catch (err) {
        console.error(
          `ElastiCache tags error for ${cluster.CacheClusterId}:`,
          err,
        );
      }

      inventory.push({
        uniqueKey: `AWS-${account.id}-ELASTICACHE-${cluster.CacheClusterId}`,
        provider: "AWS",
        accountName: account.name,
        accountId: account.id,
        service: "ElastiCache",
        name: cluster.CacheClusterId || "N/A",
        id: cluster.ARN || "N/A",
        host:
          cluster.ConfigurationEndpoint?.Address ||
          cluster.CacheNodes?.[0]?.Endpoint?.Address ||
          "N/A",
        status: cluster.CacheClusterStatus || "UNKNOWN",
        operatingSystem: cluster.Engine || "N/A",
        platform: cluster.EngineVersion || "N/A",
        architecture: cluster.CacheNodeType || "N/A",
        instanceType: cluster.CacheNodeType || "N/A",
        availabilityZone: cluster.PreferredAvailabilityZone || "N/A",
        tags,
        raw: {
          arn: cluster.ARN,
          numCacheNodes: cluster.NumCacheNodes,
          replicationGroupId: cluster.ReplicationGroupId,
          snapshotRetentionLimit: cluster.SnapshotRetentionLimit,
          snapshotWindow: cluster.SnapshotWindow,
          autoMinorVersionUpgrade: cluster.AutoMinorVersionUpgrade,
          cacheSubnetGroupName: cluster.CacheSubnetGroupName,
          cacheSecurityGroups: cluster.CacheSecurityGroups,
          securityGroups: cluster.SecurityGroups,
          configurationEndpoint: cluster.ConfigurationEndpoint,
          engine: cluster.Engine,
          engineVersion: cluster.EngineVersion,
          cacheNodes: cluster.CacheNodes?.map((node) => ({
            id: node.CacheNodeId,
            status: node.CacheNodeStatus,
            availabilityZone: node.PreferredAvailabilityZone,
            createTime: node.CacheNodeCreateTime,
          })),
          atRestEncryptionEnabled: cluster.AtRestEncryptionEnabled,
          transitEncryptionEnabled: cluster.TransitEncryptionEnabled,
          authTokenEnabled: cluster.AuthTokenEnabled,
        },
      });
    }

    // Describe Replication Groups
    const replicationData = await client.send(
      new DescribeReplicationGroupsCommand({}),
    );

    for (const replication of replicationData.ReplicationGroups || []) {
      let tags: Record<string, string> = {};

      try {
        if (replication.ARN) {
          const tagsData = await client.send(
            new ListTagsForResourceCommand({
              ResourceName: replication.ARN,
            }),
          );
          tags = formatAwsTags(tagsData.TagList || []);
        }
      } catch (err) {
        console.error(
          `ElastiCache replication tags error for ${replication.ReplicationGroupId}:`,
          err,
        );
      }

      inventory.push({
        uniqueKey: `AWS-${account.id}-ELASTICACHE-REP-${replication.ReplicationGroupId}`,
        provider: "AWS",
        accountName: account.name,
        accountId: account.id,
        service: "ElastiCache",
        name: replication.ReplicationGroupId || "N/A",
        id: replication.ARN || "N/A",
        host: replication.PrimaryEndpoint?.Address || "N/A",
        status: replication.Status || "UNKNOWN",
        operatingSystem: replication.Engine || "N/A",
        platform: replication.EngineVersion || "N/A",
        architecture: replication.CacheNodeType || "N/A",
        instanceType: replication.CacheNodeType || "N/A",
        availabilityZone: replication.Region || region,
        tags,
        raw: {
          arn: replication.ARN,
          description: replication.Description,
          engine: replication.Engine,
          engineVersion: replication.EngineVersion,
          multiAz: replication.MultiAZ,
          automaticFailover: replication.AutomaticFailover,
          pendingReboot: replication.PendingRebootValues,
          transitEncryption: replication.TransitEncryptionEnabled,
          authToken: replication.AuthTokenEnabled,
          kmsKeyId: replication.KmsKeyId,
          atRestEncryption: replication.AtRestEncryptionEnabled,
          memberClusters: replication.MemberClusters,
          nodeGroups: replication.NodeGroups,
          snapshotRetentionLimit: replication.SnapshotRetentionLimit,
          snapshotWindow: replication.SnapshotWindow,
        },
      });
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS ElastiCache ERROR:", error?.message || error);
    return [];
  }
}
