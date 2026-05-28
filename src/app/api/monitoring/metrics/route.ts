import { NextRequest, NextResponse } from "next/server";
import {
  readMonitoringCache,
  getCacheAge,
  writeMonitoringCache,
} from "@/lib/monitoring/cache";
import { collectAllAccountsMetrics } from "@/lib/monitoring/collector";
import {
  startMonitoringBackgroundJob,
  getBackgroundJobStatus,
} from "@/lib/monitoring/background";

export const dynamic = "force-dynamic";

const CACHE_TTL = 60 * 1000; // 1 minuto

let isRefreshing = false;

async function buildMonitoringData() {
  const metricsData = await collectAllAccountsMetrics();
  return {
    accounts: metricsData,
  };
}

async function refreshMonitoring() {
  try {
    console.log("[MONITORING API] Background refresh start");
    const data = await buildMonitoringData();
    writeMonitoringCache({ timestamp: Date.now(), data });
    console.log("[MONITORING API] Background refresh done");
  } catch (err) {
    console.error("[MONITORING API] Background refresh error:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const forceRefresh = searchParams.get("refresh") === "true";

    // Iniciar el background job si no está corriendo
    startMonitoringBackgroundJob();

    let monitoringData;
    const cached = readMonitoringCache();

    if (cached && !forceRefresh) {
      const age = getCacheAge(cached);
      const ageSeconds = Math.floor(age / 1000);
      console.log(`[MONITORING API] Cache age: ${ageSeconds}s`);

      // Si el caché es muy viejo y no estamos refrescando, iniciar refresh en background
      if (age > CACHE_TTL && !isRefreshing) {
        isRefreshing = true;
        refreshMonitoring().finally(() => {
          isRefreshing = false;
        });
      }

      monitoringData = cached.data;
    } else {
      console.log("[MONITORING API] No cache found or force refresh requested");
      isRefreshing = true;
      monitoringData = await buildMonitoringData();
      writeMonitoringCache({ timestamp: Date.now(), data: monitoringData });
      isRefreshing = false;
    }

    // Si se solicita una cuenta específica, filtrar
    if (accountId && monitoringData.accounts[accountId]) {
      return NextResponse.json({
        success: true,
        source: cached ? "cache" : "fresh",
        timestamp: cached?.timestamp ?? Date.now(),
        cacheAge: cached ? getCacheAge(cached) : 0,
        refreshing: isRefreshing,
        backgroundJob: getBackgroundJobStatus(),
        account: monitoringData.accounts[accountId],
      });
    }

    // Calcular resumen general
    const accounts = Object.values(monitoringData.accounts);
    const summary = {
      totalAccounts: accounts.length,
      totalEC2: accounts.reduce((sum, acc) => sum + acc.ec2.summary.total, 0),
      runningEC2: accounts.reduce(
        (sum, acc) => sum + acc.ec2.summary.running,
        0,
      ),
      totalRDS: accounts.reduce((sum, acc) => sum + acc.rds.summary.total, 0),
      availableRDS: accounts.reduce(
        (sum, acc) => sum + acc.rds.summary.available,
        0,
      ),
      totalECSClusters: accounts.reduce(
        (sum, acc) => sum + acc.ecs.summary.totalClusters,
        0,
      ),
      totalECSTasks: accounts.reduce(
        (sum, acc) => sum + acc.ecs.summary.totalTasks,
        0,
      ),
    };

    return NextResponse.json({
      success: true,
      source: cached ? "cache" : "fresh",
      timestamp: cached?.timestamp ?? Date.now(),
      cacheAge: cached ? getCacheAge(cached) : 0,
      refreshing: isRefreshing,
      backgroundJob: getBackgroundJobStatus(),
      summary,
      accounts: monitoringData.accounts,
    });
  } catch (error) {
    isRefreshing = false;
    console.error("[MONITORING API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
