import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  type FilteredLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";

import type { AWSAccount } from "./accounts";
import type {
  LogEntry,
  LogFilters,
  AWSLogGroup,
  AWSLogStream,
} from "@/types/monitoring";

const region = process.env.AWS_REGION || "us-east-1";

// Helper to detect log level from message
function detectLogLevel(message: string): LogEntry["severity"] {
  const upperMessage = message.toUpperCase();
  if (
    upperMessage.includes("ERROR") ||
    upperMessage.includes("EXCEPTION") ||
    upperMessage.includes("FATAL")
  ) {
    return "ERROR";
  }
  if (upperMessage.includes("WARN") || upperMessage.includes("WARNING")) {
    return "WARN";
  }
  if (upperMessage.includes("DEBUG")) {
    return "DEBUG";
  }
  if (upperMessage.includes("TRACE")) {
    return "TRACE";
  }
  return "INFO";
}

export async function getCloudWatchLogGroups(
  account: AWSAccount,
): Promise<AWSLogGroup[]> {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new CloudWatchLogsClient({
      region,
      credentials,
    });

    const command = new DescribeLogGroupsCommand({
      limit: 50,
    });

    const response = await client.send(command);

    return (response.logGroups || []).map((group) => ({
      logGroupName: group.logGroupName || "",
    arn: group.arn,
      creationTime: group.creationTime,
      storedBytes: group.storedBytes,
    }));
  } catch (error: any) {
    console.error(
      `CloudWatch Log Groups error for ${account.name}:`,
      error?.message || error,
    );
    return [];
  }
}

export async function getCloudWatchLogStreams(
  account: AWSAccount,
  logGroupName: string,
): Promise<AWSLogStream[]> {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new CloudWatchLogsClient({
      region,
      credentials,
    });

    const command = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: "LastEventTime",
      descending: true,
      limit: 50,
    });

    const response = await client.send(command);

    return (response.logStreams || []).map((stream) => ({
      logStreamName: stream.logStreamName || "",
      creationTime: stream.creationTime,
      firstEventTimestamp: stream.firstEventTimestamp,
      lastEventTimestamp: stream.lastEventTimestamp,
    }));
  } catch (error: any) {
    console.error(
      `CloudWatch Log Streams error for ${account.name}/${logGroupName}:`,
      error?.message || error,
    );
    return [];
  }
}

export async function getCloudWatchLogs(
  account: AWSAccount,
  filters: LogFilters,
): Promise<LogEntry[]> {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new CloudWatchLogsClient({
      region,
      credentials,
    });

    // Get log groups first
    const logGroups = await getCloudWatchLogGroups(account);

    if (logGroups.length === 0) {
      return [];
    }

    const allLogs: LogEntry[] = [];

    // Query logs from each log group (limit to 5 most recent groups to avoid timeout)
    const groupsToQuery = logGroups.slice(0, 5);

    for (const logGroup of groupsToQuery) {
      try {
        const command = new FilterLogEventsCommand({
          logGroupName: logGroup.logGroupName,
          startTime: filters.startTime
            ? new Date(filters.startTime).getTime()
            : Date.now() - 3600000, // Last hour
          endTime: filters.endTime
            ? new Date(filters.endTime).getTime()
            : Date.now(),
          filterPattern: filters.searchText || "",
          limit: Math.min(filters.limit || 100, 100),
        });

        const response = await client.send(command);

        for (const event of response.events || []) {
          const message = event.message || "";
          const severity = detectLogLevel(message);

          // Apply severity filter if specified
          if (filters.severity && severity !== filters.severity) {
            continue;
          }

          allLogs.push({
            id: `${account.id}-${event.eventId || Date.now()}`,
            timestamp: new Date(event.timestamp || Date.now()).toISOString(),
            message,
            severity,
            provider: "aws",
            account: account.name,
            region: region,
            logGroup: logGroup.logGroupName,
            logStream: event.logStreamName,
            metadata: {
              eventId: event.eventId,
              ingestionTime: event.ingestionTime,
            },
          });
        }
      } catch (err) {
        console.error(
          `Error querying log group ${logGroup.logGroupName}:`,
          err,
        );
      }
    }
    // Sort by timestamp descending
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return allLogs.slice(0, filters.limit || 100);
  } catch (error: any) {
    console.error(
      `CloudWatch Logs error for ${account.name}:`,
      error?.message || error,
    );
    return [];
  }
}
