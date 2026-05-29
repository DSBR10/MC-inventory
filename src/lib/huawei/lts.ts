import { huaweiRequest } from "./auth";
import type { HuaweiAccount } from "./accounts";
import type {
  LogEntry,
  LogFilters,
  HuaweiLogGroup,
  HuaweiLogStream,
} from "@/types/monitoring";

const HUAWEI_LTS_ENABLED =
  process.env.HUAWEI_LTS_ENABLED !== "false";

function getTimeRange(filters: LogFilters) {
  const fallbackEnd = Date.now();
  const fallbackStart = fallbackEnd - 3600000;

  const parsedStart = filters.startTime
    ? new Date(filters.startTime).getTime()
    : fallbackStart;

  const parsedEnd = filters.endTime
    ? new Date(filters.endTime).getTime()
    : fallbackEnd;

  const startTime = Number.isFinite(parsedStart)
    ? parsedStart
    : fallbackStart;

  const endTime = Number.isFinite(parsedEnd)
    ? parsedEnd
    : fallbackEnd;

  if (endTime > startTime) {
    return { startTime, endTime };
  }

  return {
    startTime: Math.min(startTime, endTime),
    endTime: Math.max(startTime, endTime) || Date.now(),
  };
}

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

export async function getHuaweiLogGroups(
  account: HuaweiAccount,
): Promise<HuaweiLogGroup[]> {
  if (!HUAWEI_LTS_ENABLED) {
    return [];
  }

  try {
    const response = await huaweiRequest({
      method: "GET",
      host: `lts.${account.region}.myhuaweicloud.com`,
      uri: `/v2/${account.projectId}/groups`,
      ak: account.ak,
      sk: account.sk,
      projectId: account.projectId,
    });

    if (response.status === 200 && response.data && response.data.log_groups) {
      return response.data.log_groups;
    }

    return [];
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error(`Huawei LTS Groups auth error for ${account.name}`);
    } else {
      console.error(
        `Huawei LTS Groups error for ${account.name}:`,
        error?.message || error,
      );
    }
    return [];
  }
}

export async function getHuaweiLogStreams(
  account: HuaweiAccount,
  logGroupId: string,
): Promise<HuaweiLogStream[]> {
  if (!HUAWEI_LTS_ENABLED) {
    return [];
  }

  try {
    const response = await huaweiRequest({
      method: "GET",
      host: `lts.${account.region}.myhuaweicloud.com`,
      uri: `/v2/${account.projectId}/groups/${logGroupId}/streams`,
      ak: account.ak,
      sk: account.sk,
      projectId: account.projectId,
    });

    if (response.status === 200 && response.data && response.data.log_streams) {
      return response.data.log_streams;
    }

    return [];
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error(`Huawei LTS Streams auth error for ${account.name}`);
    } else {
    console.error(
        `Huawei LTS Streams error for ${account.name}:`,
        error?.message || error,
      );
    }
    return [];
  }
}

export async function getHuaweiLogs(
  account: HuaweiAccount,
  filters: LogFilters,
): Promise<LogEntry[]> {
  if (!HUAWEI_LTS_ENABLED) {
    return [];
  }

  try {

    // Get log groups first
    const logGroups = await getHuaweiLogGroups(account);

    if (logGroups.length === 0) {
      return [];
    }

    const allLogs: LogEntry[] = [];

    // Query logs from each group (limit to 3 to avoid timeout)
    const groupsToQuery = logGroups.slice(0, 3);

    for (const logGroup of groupsToQuery) {
      try {
        // Get streams for this group
        const streams = await getHuaweiLogStreams(
          account,
          logGroup.log_group_id,
        );

        if (streams.length === 0) continue;

        // Query logs from first stream (most recent)
        const stream = streams[0];

        const { startTime, endTime } = getTimeRange(filters);

        const requestBody: any = {
          start_time: startTime.toString(),
          end_time: endTime.toString(),
          labels: {},
          is_desc: true,
          is_iterative: false,
        };

        if (filters.searchText) {
          requestBody.keywords = filters.searchText;
        }

        const response = await huaweiRequest({
          method: "POST",
          host: `lts.${account.region}.myhuaweicloud.com`,
          uri: `/v2/${account.projectId}/groups/${logGroup.log_group_id}/streams/${stream.log_stream_id}/content/query`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
          body: requestBody,
        });

        if (response.status === 200 && response.data && response.data.logs) {
          for (const log of response.data.logs) {
            const message = log.content || log.message || JSON.stringify(log);
            const severity = detectLogLevel(message);

            // Apply severity filter
            if (filters.severity && severity !== filters.severity) {
              continue;
            }

            allLogs.push({
              id: `${account.projectId}-${log.log_id || Date.now()}`,
              timestamp: new Date(
                parseInt(log.timestamp || log.time || Date.now()),
              ).toISOString(),
              message,
              severity,
              provider: "huawei",
              account: account.name,
              region: account.region,
              logGroup: logGroup.log_group_name,
              logStream: stream.log_stream_name,
              metadata: {
              logId: log.log_id,
                lineNum: log.line_num,
              },
            });
          }
        }
      } catch (err: any) {
        console.error(
          `Error querying Huawei log group ${logGroup.log_group_name}:`,
          err?.message || err,
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
      `Huawei LTS error for ${account.name}:`,
      error?.message || error,
    );
    return [];
  }
}
