// Monitoring and Logs Types

export type LogSeverity =
  | "DEBUG"
  | "INFO"
  | "WARNING"
  | "WARN"
  | "ERROR"
  | "CRITICAL";
export type CloudProvider = "aws" | "huawei";

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  severity: LogSeverity;
  provider: CloudProvider;
  account: string;
  region?: string;
  logGroup?: string;
  logStream?: string;
  metadata?: Record<string, any>;
}

export interface LogFilters {
  startTime?: string;
  endTime?: string;
  severity?: LogSeverity;
  searchText?: string;
  provider?: CloudProvider;
  account?: string;
  region?: string;
  logGroup?: string;
  limit?: number;
}

export interface MonitoringMetrics {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  metrics?: MonitoringMetrics;
}

// AWS CloudWatch Types
export interface AWSLogGroup {
  logGroupName: string;
  arn?: string;
  creationTime?: number;
  storedBytes?: number;
}

export interface AWSLogStream {
  logStreamName: string;
  creationTime?: number;
  firstEventTimestamp?: number;
  lastEventTimestamp?: number;
}

// Huawei Cloud LTS Types
export interface HuaweiLogGroup {
  log_group_id: string;
  log_group_name: string;
  creation_time: number;
  ttl_in_days: number;
}

export interface HuaweiLogStream {
  log_stream_id: string;
  log_stream_name: string;
  creation_time: number;
  tag?: Record<string, string>;
}
