import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { CloudWatchLog, LogGroup, LogStream } from "@/types/monitoring-aws";
import { resolveSecret } from "@/lib/secrets/crypto";

export class CloudWatchLogsService {
  private client: CloudWatchLogsClient;

  constructor(
    region: string = process.env.AWS_REGION || "us-east-1",
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    this.client = new CloudWatchLogsClient({
      region,
      credentials: credentials || {
        accessKeyId: resolveSecret(process.env.AWS_ACCESS_KEY_ID || ""),
        secretAccessKey: resolveSecret(process.env.AWS_SECRET_ACCESS_KEY || ""),
      },
    });
  }

  /**
   * Obtiene logs de un log group específico
   */
  async getLogs(
    logGroupName: string,
    startTime?: Date,
    endTime?: Date,
    filterPattern?: string,
    limit: number = 100,
  ): Promise<CloudWatchLog[]> {
    const command = new FilterLogEventsCommand({
      logGroupName,
      startTime: startTime?.getTime(),
      endTime: endTime?.getTime(),
      filterPattern,
      limit,
    });

    const response = await this.client.send(command);

    return (response.events || []).map((event) => ({
      logGroupName,
      logStreamName: event.logStreamName || "",
      timestamp: new Date(event.timestamp || Date.now()).toISOString(),
      message: event.message || "",
      eventId: event.eventId || "",
    }));
  }

  /**
   * Lista todos los log groups disponibles
   */
  async listLogGroups(): Promise<LogGroup[]> {
    const command = new DescribeLogGroupsCommand({});
    const response = await this.client.send(command);

    return (response.logGroups || []).map((lg) => ({
      logGroupName: lg.logGroupName || "",
      creationTime: lg.creationTime
        ? new Date(lg.creationTime).toISOString()
        : undefined,
      storedBytes: lg.storedBytes,
      retentionInDays: lg.retentionInDays,
    }));
  }

  /**
   * Lista todos los log streams de un log group
   */
  async listLogStreams(logGroupName: string): Promise<LogStream[]> {
    const command = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: "LastEventTime",
      descending: true,
    });

    const response = await this.client.send(command);

    return (response.logStreams || []).map((ls) => {
      const stream = ls as any;
      return {
      logStreamName: ls.logStreamName || "",
      creationTime: ls.creationTime
        ? new Date(ls.creationTime).toISOString()
        : undefined,
      lastEventTime: stream.lastEventTime
        ? new Date(stream.lastEventTime).toISOString()
        : undefined,
      lastIngestionTime: stream.lastIngestionTime
        ? new Date(stream.lastIngestionTime).toISOString()
        : undefined,
      };
    });
  }
}
