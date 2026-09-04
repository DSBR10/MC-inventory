import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
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
export const runtime = "nodejs";

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
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
    if (guard.response) return guard.response;

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
      await recordApiAudit(request, guard.session, {
        action: "monitoring.metrics.view",
        result: "success",
        statusCode: 200,
        startedAt,
        metadata: { account: accountId.slice(0, 128), source: cached ? "cache" : "fresh" },
      });
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

    await recordApiAudit(request, guard.session, {
      action: "monitoring.metrics.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { accountCount: accounts.length, source: cached ? "cache" : "fresh" },
    });
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
  } catch {
    isRefreshing = false;
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.metrics.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron consultar las métricas",
      },
      { status: 500 },
    );
  }
}
