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

// AWS CloudTrail Types
export interface CloudTrailEvent {
  eventId: string;
  eventName: string;
  eventTime: string;
  eventSource: string;
  username: string;
  resources?: Array<{
    resourceType?: string;
    resourceName?: string;
  }>;
  errorCode?: string;
  errorMessage?: string;
  sourceIPAddress?: string;
  userAgent?: string;
  requestParameters?: Record<string, any>;
  responseElements?: Record<string, any>;
}

// AWS CloudWatch Metrics Types
export type MetricNamespace =
  | 'AWS/EC2'
  | 'AWS/RDS'
  | 'AWS/ECS'
  | 'AWS/ApplicationELB'
  | 'AWS/NetworkELB'
  | 'AWS/Lambda'
  | 'AWS/DynamoDB'
  | 'AWS/S3';

export interface CloudWatchMetricDatapoint {
  timestamp: string;
  value: number;
  unit?: string;
}

export interface CloudWatchMetric {
  metricName: string;
  namespace: MetricNamespace;
  dimensions: Array<{ name: string; value: string }>;
  datapoints: CloudWatchMetricDatapoint[];
  statistics: string; // Average, Sum, Maximum, Minimum, SampleCount
}

export interface ResourceMetrics {
  resourceId: string;
  resourceType: string;
  resourceName?: string;
  account: string;
  region: string;
  metrics: CloudWatchMetric[];
  timestamp: string;
}

// EC2 Metrics
export interface EC2Metrics {
  instanceId: string;
  instanceName?: string;
  cpuUtilization: number;
  networkIn: number;
  networkOut: number;
  diskReadOps?: number;
  diskWriteOps?: number;
  statusCheckFailed?: number;
}

// RDS Metrics
export interface RDSMetrics {
  dbInstanceId: string;
  dbInstanceName?: string;
  cpuUtilization: number;
  databaseConnections: number;
  freeableMemory: number;
  freeStorageSpace: number;
  readIOPS?: number;
  writeIOPS?: number;
  readLatency?: number;
  writeLatency?: number;
}

// ECS Metrics
export interface ECSMetrics {
  clusterName: string;
  serviceName?: string;
  taskDefinition?: string;
  cpuUtilization: number;
  memoryUtilization: number;
  runningTasksCount?: number;
  pendingTasksCount?: number;
}

// Aggregated Metrics Response
export interface MetricsResponse {
  ec2?: EC2Metrics[];
  rds?: RDSMetrics[];
  ecs?: ECSMetrics[];
  timestamp: string;
}
