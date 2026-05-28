import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
} from "@aws-sdk/client-cloudwatch";
import type {
  CloudWatchMetric,
  EC2Metrics,
  RDSMetrics,
  ECSMetrics,
  MetricNamespace,
  CloudWatchMetricDatapoint,
} from "@/types/monitoring";
import type { AWSAccount } from "./aws-accounts";

// Helper function to get CloudWatch client
function getCloudWatchClient(account: AWSAccount): CloudWatchClient {
  return new CloudWatchClient({
    region: account.region,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
  });
}

// Get metric statistics from CloudWatch
async function getMetricStatistics(
  client: CloudWatchClient,
  namespace: MetricNamespace,
  metricName: string,
  dimensions: Array<{ Name: string; Value: string }>,
  startTime: Date,
  endTime: Date,
  period: number = 300, // 5 minutes
  statistics: string[] = ["Average"],
): Promise<CloudWatchMetricDatapoint[]> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: statistics,
    });

    const response = await client.send(command);

    if (!response.Datapoints || response.Datapoints.length === 0) {
      return [];
    }

    return response.Datapoints.map((dp) => ({
      timestamp: dp.Timestamp?.toISOString() || "",
      value: dp.Average || dp.Sum || dp.Maximum || dp.Minimum || 0,
      unit: dp.Unit,
    })).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  } catch (error) {
    console.error(`Error getting metric ${metricName}:`, error);
    return [];
  }
}

// Get latest value from datapoints
function getLatestValue(datapoints: CloudWatchMetricDatapoint[]): number {
  if (datapoints.length === 0) return 0;
  return datapoints[datapoints.length - 1].value;
}

// Get EC2 instance metrics
export async function getEC2Metrics(
  account: AWSAccount,
  instanceIds: string[],
): Promise<EC2Metrics[]> {
  const client = getCloudWatchClient(account);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 3600000); // Last hour

  const metrics: EC2Metrics[] = [];

  for (const instanceId of instanceIds) {
    try {
      const dimensions = [{ Name: "InstanceId", Value: instanceId }];

      const [
        cpuData,
        networkInData,
        networkOutData,
        diskReadData,
        diskWriteData,
        statusCheckData,
      ] = await Promise.all([
        getMetricStatistics(
          client,
          "AWS/EC2",
          "CPUUtilization",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/EC2",
          "NetworkIn",
          dimensions,
          startTime,
          endTime,
          300,
          ["Sum"],
        ),
        getMetricStatistics(
          client,
          "AWS/EC2",
          "NetworkOut",
          dimensions,
          startTime,
          endTime,
          300,
          ["Sum"],
        ),
        getMetricStatistics(
          client,
          "AWS/EC2",
          "DiskReadOps",
          dimensions,
          startTime,
          endTime,
          300,
          ["Sum"],
        ),
        getMetricStatistics(
          client,
          "AWS/EC2",
          "DiskWriteOps",
          dimensions,
          startTime,
          endTime,
          300,
          ["Sum"],
        ),
        getMetricStatistics(
          client,
          "AWS/EC2",
          "StatusCheckFailed",
          dimensions,
          startTime,
          endTime,
          300,
          ["Maximum"],
        ),
      ]);

      metrics.push({
        instanceId,
        cpuUtilization: getLatestValue(cpuData),
        networkIn: getLatestValue(networkInData),
        networkOut: getLatestValue(networkOutData),
        diskReadOps: getLatestValue(diskReadData),
        diskWriteOps: getLatestValue(diskWriteData),
        statusCheckFailed: getLatestValue(statusCheckData),
      });
    } catch (error) {
      console.error(`Error fetching EC2 metrics for ${instanceId}:`, error);
    }
  }

  return metrics;
}

// Get RDS instance metrics
export async function getRDSMetrics(
  account: AWSAccount,
  dbInstanceIds: string[],
): Promise<RDSMetrics[]> {
  const client = getCloudWatchClient(account);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 3600000); // Last hour

  const metrics: RDSMetrics[] = [];

  for (const dbInstanceId of dbInstanceIds) {
    try {
      const dimensions = [
        { Name: "DBInstanceIdentifier", Value: dbInstanceId },
      ];

      const [
        cpuData,
        connectionsData,
        memoryData,
        storageData,
        readIOPSData,
        writeIOPSData,
        readLatencyData,
        writeLatencyData,
      ] = await Promise.all([
        getMetricStatistics(
          client,
          "AWS/RDS",
          "CPUUtilization",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "DatabaseConnections",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "FreeableMemory",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "FreeStorageSpace",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "ReadIOPS",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "WriteIOPS",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "ReadLatency",
          dimensions,
          startTime,
          endTime,
        ),
        getMetricStatistics(
          client,
          "AWS/RDS",
          "WriteLatency",
          dimensions,
          startTime,
          endTime,
        ),
      ]);

      metrics.push({
        dbInstanceId,
        cpuUtilization: getLatestValue(cpuData),
        databaseConnections: getLatestValue(connectionsData),
        freeableMemory: getLatestValue(memoryData),
        freeStorageSpace: getLatestValue(storageData),
        readIOPS: getLatestValue(readIOPSData),
        writeIOPS: getLatestValue(writeIOPSData),
        readLatency: getLatestValue(readLatencyData),
        writeLatency: getLatestValue(writeLatencyData),
      });
    } catch (error) {
      console.error(`Error fetching RDS metrics for ${dbInstanceId}:`, error);
    }
  }

  return metrics;
}
