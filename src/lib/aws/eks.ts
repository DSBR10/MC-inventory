import {
  EKSClient,
  ListClustersCommand,
  DescribeClusterCommand,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
} from "@aws-sdk/client-eks";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

export async function getAWSEKSInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new EKSClient({
      region,
      credentials,
    });

    // List all clusters
    const clustersData = await client.send(new ListClustersCommand({}));

    const inventory: any[] = [];

    for (const clusterName of clustersData.clusters || []) {
      try {
        // Get cluster details
        const clusterData = await client.send(
          new DescribeClusterCommand({
            name: clusterName,
          }),
        );

        const cluster = clusterData.cluster;
        if (!cluster) continue;

        // Get node groups
        const nodegroupsData = await client.send(
          new ListNodegroupsCommand({
            clusterName: clusterName,
          }),
        );

        // Build node groups as children
        const children: any[] = [];

        for (const nodegroupName of nodegroupsData.nodegroups || []) {
          try {
            const nodegroupData = await client.send(
              new DescribeNodegroupCommand({
                clusterName: clusterName,
                nodegroupName: nodegroupName,
              }),
            );

            const nodegroup = nodegroupData.nodegroup;
            if (!nodegroup) continue;

            children.push({
              uniqueKey: `AWS-${account.id}-EKS-NODEGROUP-${clusterName}-${nodegroupName}`,
              provider: "AWS",
              accountName: account.name,
              accountId: account.id,
              service: "EKS NodeGroup",
              resourceType: "nodegroup",
              name: nodegroupName,
              id: nodegroup.nodegroupArn || "N/A",
              host: clusterName,
              status: nodegroup.status || "UNKNOWN",
              operatingSystem: nodegroup.version || "N/A",
              platform: nodegroup.releaseVersion || "N/A",
              architecture: (nodegroup as any).architecture || "x86_64",
              instanceType:
                nodegroup.instanceTypes?.[0] || nodegroup.nodeRole || "N/A",
              availabilityZone: nodegroup.subnets?.[0] || "N/A",
              tags: formatAwsTags(nodegroup.tags || {}),
              raw: {
                arn: nodegroup.nodegroupArn,
                clusterName: clusterName,
                nodegroupName: nodegroupName,
                nodeRole: nodegroup.nodeRole,
                subnets: nodegroup.subnets,
                instanceTypes: nodegroup.instanceTypes,
                scalingConfig: nodegroup.scalingConfig,
                diskSize: nodegroup.diskSize,
                amiType: nodegroup.amiType,
                remoteAccess: nodegroup.remoteAccess,
                createdAt: nodegroup.createdAt,
                modifiedAt: nodegroup.modifiedAt,
                version: nodegroup.version,
                releaseVersion: nodegroup.releaseVersion,
                launchTemplate: nodegroup.launchTemplate,
                capacityType: nodegroup.capacityType,
              },
            });
          } catch (err) {
            console.error(
              `EKS Nodegroup error for ${clusterName}/${nodegroupName}:`,
              err,
            );
          }
        }

        // Add cluster to inventory with children
        inventory.push({
          uniqueKey: `AWS-${account.id}-EKS-${clusterName}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "EKS",
          name: clusterName,
          id: cluster.arn || "N/A",
          host: cluster.endpoint || "N/A",
          status: cluster.status || "UNKNOWN",
          operatingSystem: cluster.version || "N/A",
          platform: cluster.platformVersion || "N/A",
          architecture: (cluster as any).architecture || "linux",
          instanceType:
            cluster.resourcesVpcConfig?.clusterSecurityGroupId || "N/A",
          availabilityZone: cluster.arn?.split(":")[3] || region,
          tags: formatAwsTags(cluster.tags || {}),
          children,
          raw: {
            arn: cluster.arn,
            createdAt: cluster.createdAt,
            endpoint: cluster.endpoint,
            roleArn: cluster.roleArn,
            version: cluster.version,
            platformVersion: cluster.platformVersion,
            vpcConfig: {
              subnetIds: cluster.resourcesVpcConfig?.subnetIds,
              securityGroupIds: cluster.resourcesVpcConfig?.securityGroupIds,
              vpcId: cluster.resourcesVpcConfig?.vpcId,
              clusterSecurityGroupId:
                cluster.resourcesVpcConfig?.clusterSecurityGroupId,
            },
            logging: cluster.logging,
            identity: cluster.identity,
            kubernetesNetworkConfig: cluster.kubernetesNetworkConfig,
            storageConfig: cluster.storageConfig,
            tags: cluster.tags,
            nodegroups: nodegroupsData.nodegroups?.length || 0,
          },
        });
      } catch (err) {
        console.error(`EKS Cluster error for ${clusterName}:`, err);
      }
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS EKS ERROR:", error?.message || error);
    return [];
  }
}
