import { getLastSuccessfulRefreshDateBogota } from "./repository";
import { isBackupRefreshRunning, refreshBackups } from "./collector";

declare global {
  var __mcInventoryBackupScheduler: boolean | undefined;
}

// Los backups se generan entre 22:00 y 04:00 (hora Colombia). El refresco
// diario corre después de esa ventana. Todo se almacena en UTC y se
// presenta en America/Bogota.
export function getBogotaNow(): { hour: number; day: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return { hour: Number(get("hour")) % 24, day: `${get("year")}-${get("month")}-${get("day")}` };
}

export function getRefreshHourBogota(): number {
  const raw = Number(process.env.BACKUP_REFRESH_HOUR_BOGOTA || 6);
  if (!Number.isInteger(raw) || raw < 0 || raw > 23) return 6;
  return raw;
}

async function tick(): Promise<void> {
  try {
    if (isBackupRefreshRunning()) return;
    const { hour, day } = getBogotaNow();
    if (hour < getRefreshHourBogota()) return;
    const lastDay = await getLastSuccessfulRefreshDateBogota();
    if (lastDay === day) return;
    console.log(`[backups] scheduled refresh start (Bogota ${day})`);
    const summary = await refreshBackups("scheduled", "scheduler");
    console.log(`[backups] scheduled refresh done: ${summary.status}, ${summary.recordsUpserted} records`);
  } catch (error) {
    console.error("[backups] scheduled refresh error:", error instanceof Error ? error.message : error);
  }
}

export function startBackupScheduler(): void {
  if (globalThis.__mcInventoryBackupScheduler) return;
  globalThis.__mcInventoryBackupScheduler = true;
  // Revisión cada 5 minutos; el tick decide si ya es hora (06:00 Bogotá) y si hoy ya se refrescó.
  setInterval(tick, 5 * 60 * 1000).unref?.();
  // Primera revisión poco después del arranque (recupera el día si el servidor estuvo caído a las 06:00).
  setTimeout(tick, 60 * 1000).unref?.();
  console.log("[backups] scheduler started (daily, America/Bogota)");
}
