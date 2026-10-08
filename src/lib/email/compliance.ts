import { queryAudit } from "@/lib/db/pool";
import type { InventoryItem } from "@/types/inventory";
import { readInventoryCache } from "@/lib/inventory/cache";

export type DayWindow = {
  /** YYYYMMDD en America/Bogota (el "día anterior"). */
  ymd: string;
  /** Inicio del día anterior en ISO (00:00 Bogotá = 05:00Z). */
  startISO: string;
  /** Fin del día anterior en ISO (= inicio de hoy Bogotá). */
  endISO: string;
  /** Etiqueta legible, ej. "6 de octubre de 2026". */
  label: string;
};

export type Coverage = "OK" | "FAILED" | "MISSING";

export type ExpectedResource = {
  provider: string;
  accountId: string;
  accountName: string;
  resourceId: string;
  resourceName: string;
};

export type ExpectedLogServer = {
  provider: string;
  accountId: string;
  accountName: string;
  serverName: string;
  bucketName: string;
  manual: boolean;
};

/** Día anterior en America/Bogota. */
export function getPreviousDayBogota(now: Date = new Date()): DayWindow {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  // Mediodía UTC del día actual en Bogotá (evita bordes por DST; Colombia es UTC-5 fijo).
  const todayNoonUTC = Date.UTC(y, m - 1, d, 12, 0, 0);
  const prevNoonUTC = todayNoonUTC - 24 * 60 * 60 * 1000;
  const prev = new Date(prevNoonUTC);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  const ymd = `${py}${pm}${pd}`;
  const startISO = `${py}-${pm}-${pd}T05:00:00.000Z`;
  const endD = new Date(prevNoonUTC + 24 * 60 * 60 * 1000);
  const ey = endD.getUTCFullYear();
  const em = String(endD.getUTCMonth() + 1).padStart(2, "0");
  const ed = String(endD.getUTCDate()).padStart(2, "0");
  const endISO = `${ey}-${em}-${ed}T05:00:00.000Z`;
  const label = prev.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return { ymd, startISO, endISO, label };
}

function asItems(cached: any): InventoryItem[] {
  if (!cached) return [];
  if (Array.isArray(cached)) return cached;
  if (Array.isArray(cached.data)) return cached.data;
  return [];
}

/** Lee el inventario cacheado (lo que muestran los módulos). */
export async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    return asItems(readInventoryCache());
  } catch {
    return [];
  }
}

export function isServerItem(item: InventoryItem): boolean {
  return (
    (item.provider === "AWS" && item.service === "EC2") ||
    (item.provider === "HUAWEI CLOUD" && item.service === "ECS")
  );
}

export function isDatabaseItem(item: InventoryItem): boolean {
  if (item.provider === "AWS") {
    return item.service === "RDS" || item.service === "Aurora" || item.service === "DocumentDB";
  }
  if (item.provider === "HUAWEI CLOUD") {
    return item.service === "RDS" || item.service === "DDS";
  }
  return false;
}

function toExpected(item: InventoryItem): ExpectedResource {
  return {
    provider: item.provider || "",
    accountId: item.accountId || "",
    accountName: item.accountName || "N/A",
    resourceId: item.id || "",
    resourceName: item.name || item.id || "",
  };
}

/** Todos los servidores que DEBEN tener backup (del inventario). */
export async function getExpectedServers(items?: InventoryItem[]): Promise<ExpectedResource[]> {
  const list = items || (await getInventoryItems());
  return list.filter(isServerItem).map(toExpected);
}

/** Todas las bases de datos que DEBEN tener backup (del inventario). */
export async function getExpectedDatabases(items?: InventoryItem[]): Promise<ExpectedResource[]> {
  const list = items || (await getInventoryItems());
  return list.filter(isDatabaseItem).map(toExpected);
}

function normKey(parts: Array<string | undefined | null>): string {
  return parts.map((p) => (p || "").trim()).join("||");
}

export function accountKey(provider?: string | null, accountId?: string | null): string {
  return normKey([provider, accountId]);
}

/**
 * Roster de servidores con backup de logs esperado:
 * UNION de la tabla manual (activa) + los vistos históricamente.
 */
export async function getExpectedLogServers(): Promise<ExpectedLogServer[]> {
  const map = new Map<string, ExpectedLogServer>();

  try {
    const manual = await queryAudit(
      `SELECT provider, account_id, account_name, server_name, bucket_name
       FROM log_expected_servers WHERE active = true`,
    );
    for (const r of manual.rows) {
      const key = normKey([r.provider, r.account_id, String(r.server_name).toLowerCase()]);
      map.set(key, {
        provider: r.provider,
        accountId: r.account_id,
        accountName: r.account_name || "N/A",
        serverName: r.server_name,
        bucketName: r.bucket_name || "",
        manual: true,
      });
    }
  } catch {
    // Tabla aún no migrada: se sigue solo con el historial.
  }

  try {
    const hist = await queryAudit(
      `SELECT DISTINCT provider, account_id, account_name, server_name, bucket_name
       FROM log_backups WHERE server_name <> '(sin carpetas)'`,
    );
    for (const r of hist.rows) {
      const key = normKey([r.provider, r.account_id, String(r.server_name).toLowerCase()]);
      if (!map.has(key)) {
        map.set(key, {
          provider: r.provider,
          accountId: r.account_id,
          accountName: r.account_name || "N/A",
          serverName: r.server_name,
          bucketName: r.bucket_name || "",
          manual: false,
        });
      }
    }
  } catch {
    // Sin historial: roster solo manual.
  }

  return [...map.values()].sort((a, b) =>
    `${a.provider}${a.accountName}${a.serverName}`.localeCompare(`${b.provider}${b.accountName}${b.serverName}`),
  );
}

export async function listExpectedLogServers(): Promise<Array<ExpectedLogServer & { id: string; active: boolean }>> {
  const res = await queryAudit(
    `SELECT id, provider, account_id, account_name, server_name, bucket_name, active
     FROM log_expected_servers ORDER BY provider, account_name, server_name`,
  );
  return res.rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    accountId: r.account_id,
    accountName: r.account_name || "N/A",
    serverName: r.server_name,
    bucketName: r.bucket_name || "",
    manual: true,
    active: !!r.active,
  }));
}

export async function addExpectedLogServer(
  input: { provider: string; accountId: string; accountName?: string; serverName: string; bucketName?: string; createdBy?: string },
): Promise<void> {
  const provider = input.provider === "HUAWEI CLOUD" ? "HUAWEI CLOUD" : "AWS";
  const serverName = input.serverName.trim();
  if (!serverName) throw new Error("serverName requerido");
  if (!input.accountId.trim()) throw new Error("accountId requerido");
  await queryAudit(
    `INSERT INTO log_expected_servers (provider, account_id, account_name, server_name, bucket_name, active, created_by)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     ON CONFLICT (provider, account_id, server_name)
     DO UPDATE SET active = true, account_name = EXCLUDED.account_name, bucket_name = EXCLUDED.bucket_name`,
    [provider, input.accountId.trim(), (input.accountName || "N/A").trim(), serverName, (input.bucketName || "").trim(), input.createdBy || null],
  );
}

export async function removeExpectedLogServer(id: string): Promise<void> {
  await queryAudit(`DELETE FROM log_expected_servers WHERE id = $1`, [id]);
}
