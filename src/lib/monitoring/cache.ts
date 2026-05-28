import fs from "fs";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), "data", "monitoring-cache.json");

export interface MonitoringCacheData {
  timestamp: number;
  data: {
    accounts: Record<string, AccountMetrics>;
  };
}

export interface AccountMetrics {
  accountId: string;
  accountName: string;
  region: string;
  ec2: EC2Metrics;
  rds: RDSMetrics;
  ecs: ECSMetrics;
  lastUpdated: number;
}

export interface EC2Metrics {
  instances: Array<{
    instanceId: string;
    instanceType: string;
    state: string;
    cpuUtilization: number;
    networkIn: number;
    networkOut: number;
  }>;
  summary: {
    total: number;
    running: number;
    stopped: number;
    avgCpu: number;
  };
}

export interface RDSMetrics {
  instances: Array<{
    dbInstanceIdentifier: string;
    engine: string;
    status: string;
    cpuUtilization: number;
    databaseConnections: number;
    freeableMemory: number;
    freeStorageSpace: number;
  }>;
  summary: {
    total: number;
    available: number;
    avgCpu: number;
    totalConnections: number;
  };
}

export interface ECSMetrics {
  clusters: Array<{
    clusterName: string;
    status: string;
    cpuUtilization: number;
    memoryUtilization: number;
    runningTasksCount: number;
    servicesCount: number;
  }>;
  summary: {
    totalClusters: number;
    totalTasks: number;
    totalServices: number;
    avgCpu: number;
    avgMemory: number;
  };
}

export function readMonitoringCache(): MonitoringCacheData | null {
  try {
    console.log("READ MONITORING CACHE:", CACHE_PATH);
    if (!fs.existsSync(CACHE_PATH)) {
      console.log("MONITORING CACHE NOT FOUND");
      return null;
    }
    const raw = fs.readFileSync(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    console.log("MONITORING CACHE LOADED");
    return data;
  } catch (err) {
    console.error("MONITORING CACHE READ ERROR:", err);
    return null;
  }
}

export function writeMonitoringCache(data: MonitoringCacheData) {
  try {
    console.log("WRITING MONITORING CACHE...");
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), "utf-8");
    console.log("MONITORING CACHE WRITTEN");
  } catch (err) {
    console.error("MONITORING CACHE WRITE ERROR:", err);
  }
}

export function getCacheAge(cache: MonitoringCacheData | null): number {
  if (!cache) return Infinity;
  return Date.now() - cache.timestamp;
}

export function isCacheValid(
  cache: MonitoringCacheData | null,
  ttl: number,
): boolean {
  if (!cache) return false;
  return getCacheAge(cache) < ttl;
}
