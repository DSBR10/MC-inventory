import { queryAudit } from "@/lib/db/pool";
import {
  accountKey,
  getExpectedLogServers,
  getPreviousDayBogota,
  type Coverage,
  type DayWindow,
} from "./compliance";

export type LogServerDetail = {
  serverName: string;
  bucketName: string;
  sizeBytes: number;
  status: string;
  folderExists: boolean;
  coverage: Coverage;
};

export type LogDateDetail = {
  backupDate: string;
  serversOk: number;
  serversTotal: number;
  missingServers: number;
  totalBytes: number;
  servers: LogServerDetail[];
};

export type LogsAccountDetail = {
  accountId: string;
  accountName: string;
  region: string;
  totalEntries: number;
  completedEntries: number;
  missingEntries: number;
  serversTracked: number;
  serversOk: number;
  serversMissing: number;
  coveragePct: number;
  datesCovered: number;
  totalBytes: number;
  lastDate: string | null;
  dates: LogDateDetail[];
};

export type LogsProviderReport = {
  provider: string;
  totalEntries: number;
  totalBytes: number;
  accounts: LogsAccountDetail[];
  completedTotal: number;
  missingTotal: number;
  successRate: number;
  failureRate: number;
};

export type LogsInformeData = {
  generatedAt: string;
  dateLabel: string;
  day: DayWindow;
  aws: LogsProviderReport;
  huawei: LogsProviderReport;
  globalSummary: {
    totalEntries: number;
    totalBytes: number;
    successRate: number;
    failureRate: number;
    expectedServers: number;
    coveredServers: number;
    missingServers: number;
    coveragePct: number;
  };
};

const OK = new Set(["COMPLETED"]);
const MISSING = new Set(["EMPTY", "NO_BACKUP"]);

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatBogota(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateLabel(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd || "—";
  const d = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T12:00:00Z`);
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Informe de cumplimiento del DÍA ANTERIOR para logs transaccionales:
 * cruza el roster esperado (manual + histórico) con la carpeta YYYYMMDD
 * de ayer en cada bucket (S3/OBS). Lo ausente sale en rojo como SIN BACKUP.
 */
export async function generateLogsInformeData(day?: DayWindow): Promise<LogsInformeData> {
  const target = day || getPreviousDayBogota();
  const now = new Date();
  const expected = await getExpectedLogServers();

  const byAccount = new Map<string, { provider: string; accountId: string; accountName: string; expected: typeof expected }>();
  for (const exp of expected) {
    const key = accountKey(exp.provider, exp.accountId);
    let entry = byAccount.get(key);
    if (!entry) {
      entry = { provider: exp.provider, accountId: exp.accountId, accountName: exp.accountName, expected: [] };
      byAccount.set(key, entry);
    }
    entry.expected.push(exp);
  }

  const windowRes = await queryAudit<{
    provider: string;
    account_id: string;
    account_name: string;
    region: string;
    bucket_name: string;
    backup_date: string;
    server_name: string;
    folder_exists: boolean;
    size_bytes: number | string;
    status: string;
  }>(
    `SELECT provider, account_id, account_name, region, bucket_name, backup_date, server_name, folder_exists, size_bytes, status
     FROM log_backups WHERE backup_date = $1
     ORDER BY provider, account_id, server_name ASC`,
    [target.ymd],
  );

  const windowByAccount = new Map<string, typeof windowRes.rows>();
  for (const row of windowRes.rows) {
    if (row.server_name === "(sin carpetas)") continue;
    const key = accountKey(row.provider, row.account_id);
    const list = windowByAccount.get(key);
    if (list) list.push(row);
    else windowByAccount.set(key, [row]);
  }

  for (const [key, rows] of windowByAccount) {
    if (!byAccount.has(key) && rows.length > 0) {
      const first = rows[0];
      byAccount.set(key, {
        provider: first.provider,
        accountId: first.account_id,
        accountName: first.account_name || "N/A",
        expected: [],
      });
    }
  }

  async function buildProviderReport(provider: "AWS" | "HUAWEI CLOUD"): Promise<LogsProviderReport> {
    const providerEntries = [...byAccount.values()].filter((a) => a.provider === provider);

    const accounts = providerEntries.map((acc) => {
      const rows = windowByAccount.get(accountKey(acc.provider, acc.accountId)) || [];
      const byServer = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        const k = r.server_name.toLowerCase();
        if (!byServer.has(k)) byServer.set(k, r);
      }

      const servers: LogServerDetail[] = [];
      let ok = 0;
      let missing = 0;
      let bytes = 0;
      let region = rows[0]?.region || "";

      for (const exp of acc.expected) {
        const rec = byServer.get(exp.serverName.toLowerCase());
        if (!rec || !rec.folder_exists || !OK.has((rec.status || "").toUpperCase()) || Number(rec.size_bytes || 0) <= 0) {
          servers.push({
            serverName: exp.serverName,
            bucketName: exp.bucketName || rec?.bucket_name || "",
            sizeBytes: rec ? Number(rec.size_bytes || 0) : 0,
            status: rec ? rec.status : "SIN BACKUP",
            folderExists: !!rec?.folder_exists,
            coverage: "MISSING",
          });
          missing++;
          continue;
        }
        servers.push({
          serverName: exp.serverName,
          bucketName: rec.bucket_name || "",
          sizeBytes: Number(rec.size_bytes || 0),
          status: rec.status,
          folderExists: true,
          coverage: "OK",
        });
        ok++;
        bytes += Number(rec.size_bytes || 0);
      }

      const seen = new Set(acc.expected.map((e) => e.serverName.toLowerCase()));
      for (const [name, rec] of byServer) {
        if (seen.has(name)) continue;
        const good = !!rec.folder_exists && OK.has((rec.status || "").toUpperCase()) && Number(rec.size_bytes || 0) > 0;
        servers.push({
          serverName: rec.server_name,
          bucketName: rec.bucket_name || "",
          sizeBytes: Number(rec.size_bytes || 0),
          status: rec.status,
          folderExists: !!rec.folder_exists,
          coverage: good ? "OK" : "FAILED",
        });
        if (good) { ok++; bytes += Number(rec.size_bytes || 0); }
      }

      servers.sort((a, b) => {
        const rank = (c: Coverage) => (c === "MISSING" ? 0 : c === "FAILED" ? 1 : 2);
        return rank(a.coverage) - rank(b.coverage) || a.serverName.localeCompare(b.serverName);
      });

      const totalServers = acc.expected.length;
      const completed = rows.filter((r) => OK.has((r.status || "").toUpperCase())).length;
      const missingRows = rows.filter((r) => MISSING.has((r.status || "").toUpperCase())).length;

      return {
        accountId: acc.accountId,
        accountName: acc.accountName,
        region,
        totalEntries: rows.length,
        completedEntries: completed,
        missingEntries: missingRows,
        serversTracked: totalServers,
        serversOk: ok,
        serversMissing: missing,
        coveragePct: totalServers ? Math.round((ok / totalServers) * 100) : 0,
        datesCovered: rows.length > 0 ? 1 : 0,
        totalBytes: bytes,
        lastDate: rows.length > 0 ? target.ymd : null,
        dates: [
          {
            backupDate: target.ymd,
            serversOk: ok,
            serversTotal: Math.max(totalServers, servers.length),
            missingServers: missing,
            totalBytes: bytes,
            servers,
          },
        ],
      };
    });

    const totalEntries = accounts.reduce((a, c) => a + c.totalEntries, 0);
    const completedTotal = accounts.reduce((a, c) => a + c.completedEntries, 0);
    const missingTotal = accounts.reduce((a, c) => a + c.missingEntries, 0);
    const totalBytes = accounts.reduce((a, c) => a + c.totalBytes, 0);

    return {
      provider: provider === "AWS" ? "AWS" : "Huawei Cloud",
      totalEntries,
      totalBytes,
      accounts,
      completedTotal,
      missingTotal,
      successRate: totalEntries ? Math.round((completedTotal / totalEntries) * 100) : 0,
      failureRate: totalEntries ? Math.round((missingTotal / totalEntries) * 100) : 0,
    };
  }

  const aws = await buildProviderReport("AWS");
  const huawei = await buildProviderReport("HUAWEI CLOUD");

  const expectedServers =
    aws.accounts.reduce((a, c) => a + c.serversTracked, 0) + huawei.accounts.reduce((a, c) => a + c.serversTracked, 0);
  const coveredServers =
    aws.accounts.reduce((a, c) => a + c.serversOk, 0) + huawei.accounts.reduce((a, c) => a + c.serversOk, 0);
  const globalTotal = aws.totalEntries + huawei.totalEntries;
  const globalOk = aws.completedTotal + huawei.completedTotal;
  const globalMissing = aws.missingTotal + huawei.missingTotal;
  const globalBytes = aws.totalBytes + huawei.totalBytes;

  return {
    generatedAt: now.toISOString(),
    dateLabel: target.label,
    day: target,
    aws,
    huawei,
    globalSummary: {
      totalEntries: globalTotal,
      totalBytes: globalBytes,
      successRate: globalTotal ? Math.round((globalOk / globalTotal) * 100) : 0,
      failureRate: globalTotal ? Math.round((globalMissing / globalTotal) * 100) : 0,
      expectedServers,
      coveredServers,
      missingServers: Math.max(0, expectedServers - coveredServers),
      coveragePct: expectedServers ? Math.round((coveredServers / expectedServers) * 100) : 0,
    },
  };
}

function providerGradient(provider: string): string {
  return provider === "AWS"
    ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
    : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
}

function renderProviderSection(report: LogsProviderReport): string {
  const gradient = providerGradient(report.provider);
  const providerLabel = report.provider === "AWS" ? "AWS" : "Huawei Cloud";

  const accountSections = report.accounts
    .map((acc) => {
      const day = acc.dates[0];
      const serverRows = (day?.servers || [])
        .map((s) => {
          const missing = s.coverage === "MISSING";
          const failed = s.coverage === "FAILED";
          const sc = missing || failed ? "#ef4444" : "#10b981";
          const sb = missing || failed ? "#fef2f2" : "#f0fdf4";
          const label = missing ? "SIN BACKUP" : failed ? s.status : "COMPLETED";
          return `<tr style="${missing ? "background:#fef2f2;" : ""}">
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#1f2937;">${esc(s.serverName)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${esc(s.bucketName)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${sc};background:${sb};${missing ? "border:1px solid #ef4444;" : ""}">${label}</span></td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;white-space:nowrap;">${formatBytes(s.sizeBytes)}</td>
          </tr>`;
        })
        .join("");
      const missingBanner = acc.serversMissing > 0
        ? `<p style="font-size:12px;font-weight:600;color:#ef4444;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;margin:0 0 12px;">⚠ ${acc.serversMissing} servidor(es) SIN BACKUP de logs en esta cuenta</p>`
        : "";

      return `
      <div style="margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;">
          <tr>
            <td style="font-size:15px;font-weight:600;color:#1f2937;">${esc(acc.accountName)}</td>
            <td align="right" style="font-size:12px;color:#9ca3af;">${esc(acc.accountId)} · ${esc(acc.region)}</td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
          <tr>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-radius:6px 0 0 6px;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Servidores</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937;margin-top:2px;">${acc.serversTracked}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Completos</div>
              <div style="font-size:20px;font-weight:700;color:#10b981;margin-top:2px;">${acc.serversOk}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Sin backup</div>
              <div style="font-size:20px;font-weight:700;color:#ef4444;margin-top:2px;">${acc.serversMissing}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-radius:0 6px 6px 0;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Cobertura</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937;margin-top:2px;">${acc.coveragePct}%</div>
            </td>
          </tr>
        </table>
        ${missingBanner}
        ${serverRows ? `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Servidor</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Bucket</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Estado</th>
              <th align="right" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Tamaño</th>
            </tr>
          </thead>
          <tbody>${serverRows}</tbody>
        </table>
        ` : `<p style="font-size:13px;color:#9ca3af;margin:0;">Sin registros.</p>`}
      </div>`;
    })
    .join("");

  return `
  <div style="margin-bottom:32px;">
    <div style="background:${gradient};padding:16px 20px;border-radius:10px 10px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <span style="font-size:18px;font-weight:700;color:#ffffff;">${providerLabel}</span>
            <span style="font-size:13px;color:rgba(255,255,255,0.8);margin-left:12px;">${report.accounts.length} cuenta(s) · ${report.totalEntries} registros · ${formatBytes(report.totalBytes)}</span>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.2);">Completitud: ${report.successRate}%</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:20px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      ${accountSections}
    </div>
  </div>`;
}

export function generateLogsEmailHtml(data: LogsInformeData): string {
  const { aws, huawei, globalSummary, dateLabel } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe diario de backups de logs transaccionales — ${esc(dateLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<center style="width:100%;padding:24px 0;">
<table cellpadding="0" cellspacing="0" border="0" width="680" style="max-width:680px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;border-radius:12px 12px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">MC Inventory</div>
            <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Informe diario de backups de logs transaccionales</div>
          </td>
          <td align="right" style="vertical-align:middle;">
            <div style="font-size:12px;color:#94a3b8;">${esc(dateLabel)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:24px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
      <div style="font-size:16px;font-weight:600;color:#1f2937;margin-bottom:6px;">Resumen ejecutivo — día anterior</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:16px;">Cobertura: ${globalSummary.coveredServers}/${globalSummary.expectedServers} servidores con logs (${globalSummary.coveragePct}%)</div>
      ${globalSummary.missingServers > 0 ? `<div style="font-size:13px;font-weight:700;color:#ffffff;background:#ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;">⚠ ${globalSummary.missingServers} SERVIDOR(ES) SIN BACKUP DE LOGS — revisar detalle en rojo</div>` : `<div style="font-size:13px;font-weight:600;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">✓ Todos los servidores tienen backup de logs del día anterior</div>`}
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-radius:8px 0 0 8px;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Registros</div>
            <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${globalSummary.totalEntries}</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Volumen total</div>
            <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${formatBytes(globalSummary.totalBytes)}</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Completitud</div>
            <div style="font-size:24px;font-weight:700;color:#10b981;margin-top:4px;">${globalSummary.successRate}%</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Faltantes</div>
            <div style="font-size:24px;font-weight:700;color:#ef4444;margin-top:4px;">${globalSummary.failureRate}%</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:0 32px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
      ${renderProviderSection(aws)}
      ${renderProviderSection(huawei)}
    </td>
  </tr>

  <tr>
    <td style="background:#1e293b;padding:20px 32px;border-radius:0 0 12px 12px;text-align:center;">
      <div style="font-size:13px;color:#94a3b8;">UX Technology · MC Inventory</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">Informe generado automáticamente · ${esc(dateLabel)}</div>
    </td>
  </tr>

</table>
</center>
</body>
</html>`;
}

export function generateLogsEmailText(data: LogsInformeData): string {
  const { aws, huawei, globalSummary, dateLabel } = data;

  const lines: string[] = [];
  lines.push("MC Inventory — Informe diario de backups de logs transaccionales (día anterior)");
  lines.push(dateLabel);
  lines.push("");
  lines.push("=== RESUMEN EJECUTIVO ===");
  lines.push(`Registros: ${globalSummary.totalEntries}`);
  lines.push(`Volumen total: ${formatBytes(globalSummary.totalBytes)}`);
  lines.push(`Completitud: ${globalSummary.successRate}%`);
  lines.push(`Faltantes: ${globalSummary.failureRate}%`);
  lines.push(`Cobertura: ${globalSummary.coveredServers}/${globalSummary.expectedServers} servidores (${globalSummary.coveragePct}%)`);
  if (globalSummary.missingServers > 0) {
    lines.push(`!!! ${globalSummary.missingServers} SERVIDOR(ES) SIN BACKUP DE LOGS !!!`);
  }
  lines.push("");

  function renderProvider(report: LogsProviderReport) {
    lines.push(`=== ${report.provider.toUpperCase()} ===`);
    lines.push(`Registros: ${report.totalEntries} | Volumen: ${formatBytes(report.totalBytes)} | Completitud: ${report.successRate}%`);
    lines.push("");
    for (const acc of report.accounts) {
      lines.push(`-- ${acc.accountName} (${acc.accountId}) — ${acc.region} --`);
      lines.push(`  Servidores: ${acc.serversTracked} | Completos: ${acc.serversOk} | Sin backup: ${acc.serversMissing} | Cobertura: ${acc.coveragePct}%`);
      lines.push("");
      for (const d of acc.dates) {
        lines.push(`  Fecha ${d.backupDate}: ${d.serversOk}/${d.serversTotal} servidores`);
        for (const s of d.servers) {
          const flag = s.coverage === "MISSING" ? "[SIN BACKUP] " : s.coverage === "FAILED" ? "[FALLIDO] " : "";
          lines.push(`    ${flag}${s.serverName} | ${s.bucketName || "—"} | ${s.status} | ${formatBytes(s.sizeBytes)}`);
        }
      }
      lines.push("");
    }
  }

  renderProvider(aws);
  renderProvider(huawei);

  lines.push("—");
  lines.push("UX Technology · MC Inventory");
  lines.push("Informe generado automáticamente");

  return lines.join("\n");
}

export function filterLogsInformeData(data: LogsInformeData, provider: "AWS" | "HUAWEI CLOUD"): LogsInformeData {
  const keep = provider === "AWS" ? data.aws : data.huawei;
  const empty: LogsProviderReport = {
    provider: provider === "AWS" ? "Huawei Cloud" : "AWS",
    totalEntries: 0,
    totalBytes: 0,
    accounts: [],
    completedTotal: 0,
    missingTotal: 0,
    successRate: 0,
    failureRate: 0,
  };
  const aws = provider === "AWS" ? keep : empty;
  const huawei = provider === "HUAWEI CLOUD" ? keep : empty;
  const covered = keep.accounts.reduce((a, c) => a + c.serversOk, 0);
  const expectedCount = keep.accounts.reduce((a, c) => a + c.serversTracked, 0);
  return {
    ...data,
    aws,
    huawei,
    globalSummary: {
      totalEntries: keep.totalEntries,
      totalBytes: keep.totalBytes,
      successRate: keep.successRate,
      failureRate: keep.failureRate,
      expectedServers: expectedCount,
      coveredServers: covered,
      missingServers: Math.max(0, expectedCount - covered),
      coveragePct: expectedCount ? Math.round((covered / expectedCount) * 100) : 0,
    },
  };
}
