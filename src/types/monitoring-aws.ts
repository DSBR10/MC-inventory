export type MetricStatistic = {
  timestamp: string | Date;
  average?: number;
  maximum?: number;
  minimum?: number;
};

export type MetricData = {
  metricName: string;
  namespace: string;
  dimensions?: Record<string, string | undefined>;
  unit?: string;
  statistics: MetricStatistic[];
};

export type LogGroup = {
  logGroupName: string;
  creationTime?: string | number;
  retentionInDays?: number;
  storedBytes?: number;
};

export type LogStream = {
  logStreamName?: string;
  creationTime?: string | number;
  firstEventTimestamp?: number;
  lastEventTimestamp?: number;
  lastEventTime?: string | number;
  lastIngestionTime?: string | number;
};

export type CloudWatchLog = {
  timestamp: string | number | Date;
  message: string;
  logStreamName?: string;
};

export type CloudTrailResource = {
  resourceType?: string;
  resourceName?: string;
};

export type CloudTrailEvent = {
  eventId?: string;
  eventName?: string;
  username?: string;
  eventTime: string | Date;
  eventSource?: string;
  resources?: CloudTrailResource[];
  cloudTrailEvent?: string;
  accessKeyId?: string;
};
