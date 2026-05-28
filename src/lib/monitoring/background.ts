import { collectAllAccountsMetrics } from "./collector";
import { writeMonitoringCache, readMonitoringCache } from "./cache";

let isRefreshing = false;
let intervalId: NodeJS.Timeout | null = null;

const REFRESH_INTERVAL = 60 * 1000; // 1 minuto

export async function refreshMonitoringCache() {
  if (isRefreshing) {
    console.log("[MONITORING] Refresh already in progress, skipping...");
    return;
  }

  isRefreshing = true;
  const startTime = Date.now();

  try {
    console.log("[MONITORING] Starting background refresh...");

    const metricsData = await collectAllAccountsMetrics();

    const cacheData = {
      timestamp: Date.now(),
      data: {
        accounts: metricsData,
      },
    };

    writeMonitoringCache(cacheData);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[MONITORING] Background refresh completed in ${duration}s`);
    console.log(
      `[MONITORING] Collected metrics for ${Object.keys(metricsData).length} accounts`,
    );
  } catch (error) {
    console.error("[MONITORING] Background refresh error:", error);
  } finally {
    isRefreshing = false;
  }
}

export function startMonitoringBackgroundJob() {
  if (intervalId) {
    console.log("[MONITORING] Background job already running");
    return;
  }

  console.log(
    `[MONITORING] Starting background job (interval: ${REFRESH_INTERVAL / 1000}s)`,
  );

  // Ejecutar inmediatamente si no hay caché
  const cache = readMonitoringCache();
  if (!cache) {
    console.log("[MONITORING] No cache found, running initial collection...");
    refreshMonitoringCache();
  }

  // Configurar intervalo
  intervalId = setInterval(() => {
    refreshMonitoringCache();
  }, REFRESH_INTERVAL);

  // Mantener el proceso vivo
  if (intervalId.unref) {
    intervalId.unref();
  }
}

export function stopMonitoringBackgroundJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[MONITORING] Background job stopped");
  }
}

export function isBackgroundJobRunning(): boolean {
  return intervalId !== null;
}

export function getBackgroundJobStatus() {
  return {
    running: isBackgroundJobRunning(),
    refreshing: isRefreshing,
    interval: REFRESH_INTERVAL,
  };
}
