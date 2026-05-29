import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  ListTaskDefinitionsCommand,
  DescribeTaskDefinitionCommand,
} from "@aws-sdk/client-ecs";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

export async function getAWSECSInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new ECSClient({
      region,
      credentials,
    });

    // List all clusters
    const clustersData = await client.send(new ListClustersCommand({}));

    const clusterArns = clustersData.clusterArns || [];
    const inventory: any[] = [];

    for (const clusterArn of clusterArns) {
      // Get cluster details
      const clusterData = await client.send(
        new DescribeClustersCommand({
          clusters: [clusterArn],
        }),
      );

      const cluster = clusterData.clusters?.[0];
      if (!cluster) continue;

      // Add cluster to inventory
      const clusterItem = {
        uniqueKey: `AWS-${account.id}-ECS-CLUSTER-${cluster.clusterName}`,
        provider: "AWS",
        accountName: account.name,
        accountId: account.id,
        service: "ECS",
        resourceType: "CLUSTER",
        name: cluster.clusterName || "N/A",
        id: cluster.clusterArn || "N/A",
        host: "ECS Cluster",
        status: cluster.status || "UNKNOWN",
        availabilityZone: region,
        tags: formatAwsTags(cluster.tags || []),
        raw: {
          registeredContainerInstancesCount: cluster.registeredContainerInstancesCount,
          runningTasksCount: cluster.runningTasksCount,
          pendingTasksCount: cluster.pendingTasksCount,
      activeServicesCount: cluster.activeServicesCount,
        },
        children: [] as any[],
      };

      // Get services in this cluster
      const servicesData = await client.send(
        new ListServicesCommand({
          cluster: clusterArn,
        }),
      );

      // Process each service
      for (const serviceArn of servicesData.serviceArns || []) {
        const serviceData = await client.send(
          new DescribeServicesCommand({
            cluster: clusterArn,
            services: [serviceArn],
          }),
        );

        const service = serviceData.services?.[0];
        if (!service) continue;

        // Get running tasks for this service
        const tasksData = await client.send(
          new ListTasksCommand({
            cluster: clusterArn,
            serviceName: service.serviceName,
            desiredStatus: "RUNNING",
          }),
        );

        const tasks: any[] = [];

        // Get task details if there are running tasks
        if (tasksData.taskArns && tasksData.taskArns.length > 0) {
          const tasksDetailsData = await client.send(
            new DescribeTasksCommand({
              cluster: clusterArn,
              tasks: tasksData.taskArns,
            }),
          );

          for (const task of tasksDetailsData.tasks || []) {
            tasks.push({
              uniqueKey: `AWS-${account.id}-ECS-TASK-${task.taskArn}`,
              provider: "AWS",
              accountName: account.name,
              accountId: account.id,
              service: "ECS",
              resourceType: "TASK",
              name: task.taskArn?.split("/").pop() || "N/A",
              id: task.taskArn || "N/A",
              host: cluster.clusterName || "N/A",
              status: task.lastStatus || "UNKNOWN",
           operatingSystem: task.platformVersion || "N/A",
              platform: task.launchType || "Fargate",
              availabilityZone: task.availabilityZone || region,
              tags: formatAwsTags(task.tags || []),
              raw: {
                taskDefinition: task.taskDefinitionArn,
                createdAt: task.createdAt,
                startedAt: task.startedAt,
                cpu: task.cpu,
                memory: task.memory,
              containers: task.containers?.length || 0,
              },
            });
          }
        }

        const serviceItem = {
          uniqueKey: `AWS-${account.id}-ECS-SERVICE-${service.serviceName}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "ECS",
          resourceType: "SERVICE",
          name: service.serviceName || "N/A",
          id: service.serviceArn || "N/A",
          host: cluster.clusterName || "N/A",
          status: service.status || "UNKNOWN",
          operatingSystem: service.platformVersion || "Fargate",
          platform: service.launchType || "Fargate",
          architecture: service.taskDefinition || "N/A",
          instanceType: service.launchType || "N/A",
          availabilityZone: region,
          tags: formatAwsTags(service.tags || []),
          raw: {
            clusterName: cluster.clusterName,
        taskDefinition: service.taskDefinition,
            desiredCount: service.desiredCount,
            runningCount: service.runningCount,
            pendingCount: service.pendingCount,
            serviceType: (service as any).serviceType,
       },
          children: tasks,
        };

        clusterItem.children.push(serviceItem);
      }

      inventory.push(clusterItem);
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS ECS ERROR:", error?.message || error);
    return [];
  }
}
