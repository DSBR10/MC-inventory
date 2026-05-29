import { getAWSAccounts } from "@/lib/aws/aws-accounts";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  Statistic,
} from "@aws-sdk/client-cloudwatch";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
} from "@aws-sdk/client-ecs";
import type {
  AccountMetrics,
  EC2Metrics,
  RDSMetrics,
  ECSMetrics,
} from "./cache";

const METRIC_PERIOD = 300; // 5 minutos
const METRIC_STATISTICS = [Statistic.Average];

export async function collectAllAccountsMetrics(): Promise<
  Record<string, AccountMetrics>
> {
  const accounts = getAWSAccounts();
  const results: Record<string, AccountMetrics> = {};

  console.log(
    `[MONITORING] Collecting metrics for ${accounts.length} AWS accounts...`,
  );

  // Procesar cuentas en paralelo (en lotes de 5 para no sobrecargar)
  const batchSize = 5;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((account) => collectAccountMetrics(account)),
    );

    batchResults.forEach((result, index) => {
      const account = batch[index];
      if (result.status === "fulfilled" && result.value) {
        results[account.id] = result.value;
        console.log(`[MONITORING] ✓ ${account.name} collected`);
      } else {
        console.error(
          `[MONITORING] ✗ ${account.name} failed:`,
          result.status === "rejected" ? result.reason : "Unknown error",
        );
      }
    });
  }

  console.log(
    `[MONITORING] Collection complete: ${Object.keys(results).length}/${accounts.length} accounts`,
  );
  return results;
}

async function collectAccountMetrics(account: any): Promise<AccountMetrics> {
  const region = account.region || process.env.AWS_REGION || "us-east-1";

  const [ec2Metrics, rdsMetrics, ecsMetrics] = await Promise.allSettled([
    collectEC2Metrics(account, region),
    collectRDSMetrics(account, region),
    collectECSMetrics(account, region),
  ]);

  return {
    accountId: account.id,
    accountName: account.name,
    region,
    ec2:
      ec2Metrics.status === "fulfilled"
        ? ec2Metrics.value
        : getEmptyEC2Metrics(),
    rds:
      rdsMetrics.status === "fulfilled"
        ? rdsMetrics.value
        : getEmptyRDSMetrics(),
    ecs:
      ecsMetrics.status === "fulfilled"
        ? ecsMetrics.value
        : getEmptyECSMetrics(),
    lastUpdated: Date.now(),
  };
}

async function collectEC2Metrics(
  account: any,
  region: string,
): Promise<EC2Metrics> {
  const ec2Client = new EC2Client({
    region,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
  });

  const cloudwatchClient = new CloudWatchClient({
    region,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
  });

  // Obtener lista de instancias
  const instancesCommand = new DescribeInstancesCommand({});
  const instancesResponse = await ec2Client.send(instancesCommand);

  const instances = [];
  let runningCount = 0;
  let stoppedCount = 0;
  let totalCpu = 0;

  for (const reservation of instancesResponse.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      if (!instance.InstanceId) continue;

      const state = instance.State?.Name || "unknown";
      if (state === "running") runningCount++;
      if (state === "stopped") stoppedCount++;

      // Obtener métrica de CPU solo para instancias running
      let cpuUtilization = 0;
      if (state === "running") {
        try {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

          const metricsCommand = new GetMetricStatisticsCommand({
            Namespace: "AWS/EC2",
            MetricName: "CPUUtilization",
            Dimensions: [{ Name: "InstanceId", Value: instance.InstanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: METRIC_PERIOD,
            Statistics: METRIC_STATISTICS,
          });

          const metricsResponse = await cloudwatchClient.send(metricsCommand);
          if (
            metricsResponse.Datapoints &&
            metricsResponse.Datapoints.length > 0
          ) {
            cpuUtilization = metricsResponse.Datapoints[0].Average || 0;
            totalCpu += cpuUtilization;
          }
        } catch (error) {
          console.error(
            `Error getting CPU metrics for ${instance.InstanceId}:`,
            error,
          );
        }
      }

      instances.push({
        instanceId: instance.InstanceId,
        instanceType: instance.InstanceType || "unknown",
        state,
        cpuUtilization,
        networkIn: 0,
        networkOut: 0,
      });
    }
  }

  const avgCpu = runningCount > 0 ? totalCpu / runningCount : 0;

  return {
    instances,
    summary: {
      total: instances.length,
      running: runningCount,
      stopped: stoppedCount,
      avgCpu,
    },
  };
}

async function collectRDSMetrics(
  account: any,
  region: string,
): Promise<RDSMetrics> {
  const rdsClient = new RDSClient({
    region,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
  });

  const cloudwatchClient = new CloudWatchClient({
    region,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
  });

  const dbInstancesCommand = new DescribeDBInstancesCommand({});
  const dbInstancesResponse = await rdsClient.send(dbInstancesCommand);

  const instances = [];
  let availableCount = 0;
  let totalCpu = 0;
  let totalConnections = 0;

  for (const dbInstance of dbInstancesResponse.DBInstances || []) {
    if (!dbInstance.DBInstanceIdentifier) continue;

    const status = dbInstance.DBInstanceStatus || "unknown";
    if (status === "available") availableCount++;

    let cpuUtilization = 0;
    let databaseConnections = 0;

    if (status === "available") {
      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

        // CPU
        const cpuCommand = new GetMetricStatisticsCommand({
          Namespace: "AWS/RDS",
          MetricName: "CPUUtilization",
          Dimensions: [
            {
              Name: "DBInstanceIdentifier",
              Value: dbInstance.DBInstanceIdentifier,
            },
          ],
          StartTime: startTime,
          EndTime: endTime,
          Period: METRIC_PERIOD,
          Statistics: METRIC_STATISTICS,
        });

        const cpuResponse = await cloudwatchClient.send(cpuCommand);
        if (cpuResponse.Datapoints && cpuResponse.Datapoints.length > 0) {
          cpuUtilization = cpuResponse.Datapoints[0].Average || 0;
          totalCpu += cpuUtilization;
        }

        // Connections
        const connectionsCommand = new GetMetricStatisticsCommand({
          Namespace: "AWS/RDS",
          MetricName: "DatabaseConnections",
          Dimensions: [
            {
              Name: "DBInstanceIdentifier",
              Value: dbInstance.DBInstanceIdentifier,
            },
          ],
          StartTime: startTime,
          EndTime: endTime,
          Period: METRIC_PERIOD,
          Statistics: METRIC_STATISTICS,
        });

        const connectionsResponse =
          await cloudwatchClient.send(connectionsCommand);
        if (
          connectionsResponse.Datapoints &&
          connectionsResponse.Datapoints.length > 0
        ) {
          databaseConnections = connectionsResponse.Datapoints[0].Average || 0;
          totalConnections += databaseConnections;
        }
      } catch (error) {
        console.error(
          `Error getting RDS metrics for ${dbInstance.DBInstanceIdentifier}:`,
          error,
        );
      }
    }

    instances.push({
      dbInstanceIdentifier: dbInstance.DBInstanceIdentifier,
      engine: dbInstance.Engine || "unknown",
      status,
      cpuUtilization,
      databaseConnections,
      freeableMemory: 0,
      freeStorageSpace: 0,
    });
  }

  const avgCpu = availableCount > 0 ? totalCpu / availableCount : 0;

  return {
    instances,
    summary: {
      total: instances.length,
      available: availableCount,
      avgCpu,
      totalConnections,
    },
  };
}

async function collectECSMetrics(
  account: any,
  region: string,
): Promise<ECSMetrics> {
  const ecsClient = new ECSClient({
    region,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
  });

  const listClustersCommand = new ListClustersCommand({});
  const listClustersResponse = await ecsClient.send(listClustersCommand);

  if (
    !listClustersResponse.clusterArns ||
    listClustersResponse.clusterArns.length === 0
  ) {
    return getEmptyECSMetrics();
  }

  const describeClustersCommand = new DescribeClustersCommand({
    clusters: listClustersResponse.clusterArns,
    include: ["STATISTICS"],
  });
  const describeClustersResponse = await ecsClient.send(
    describeClustersCommand,
  );

  const clusters = [];
  let totalTasks = 0;
  let totalServices = 0;

  for (const cluster of describeClustersResponse.clusters || []) {
    if (!cluster.clusterName) continue;

    const runningTasksCount = cluster.runningTasksCount || 0;
    const servicesCount = cluster.activeServicesCount || 0;

    totalTasks += runningTasksCount;
    totalServices += servicesCount;

    clusters.push({
      clusterName: cluster.clusterName,
      status: cluster.status || "UNKNOWN",
      cpuUtilization: 0, // CloudWatch metrics would be needed for this
      memoryUtilization: 0,
      runningTasksCount,
      servicesCount,
    });
  }

  return {
    clusters,
    summary: {
      totalClusters: clusters.length,
      totalTasks,
      totalServices,
      avgCpu: 0,
      avgMemory: 0,
    },
  };
}

function getEmptyEC2Metrics(): EC2Metrics {
  return {
    instances: [],
    summary: { total: 0, running: 0, stopped: 0, avgCpu: 0 },
  };
}

function getEmptyRDSMetrics(): RDSMetrics {
  return {
    instances: [],
    summary: { total: 0, available: 0, avgCpu: 0, totalConnections: 0 },
  };
}

function getEmptyECSMetrics(): ECSMetrics {
  return {
    clusters: [],
    summary: {
      totalClusters: 0,
      totalTasks: 0,
      totalServices: 0,
      avgCpu: 0,
      avgMemory: 0,
    },
  };
}
