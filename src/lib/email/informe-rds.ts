import { queryAudit } from "@/lib/db/pool";
import {
  accountKey,
  getExpectedDatabases,
  getPreviousDayBogota,
  type Coverage,
  type DayWindow,
  type ExpectedResource,
} from "./compliance";

export type RdsSnapshotDetail = {
  snapshotName: string;
  snapshotId: string;
  snapshotType: string;
  status: string;
  sizeBytes: number | null;
  snapshotCreatedAt: string | null;
  snapshotCompletedAt: string | null;
};

export type RdsInstanceDetail = {
  dbInstanceName: string;
  dbInstanceId: string;
  engine: string;
  totalSnapshots: number;
  lastSnapshot: string | null;
  coverage: Coverage;
  snapshots: RdsSnapshotDetail[];
};

export type RdsAccountDetail = {
  accountId: string;
  accountName: string;
  region: string;
  totalSnapshots: number;
  successfulSnapshots: number;
  failedSnapshots: number;
  inProgressSnapshots: number;
  engines: string[];
  instanceCount: number;
  missingInstances: number;
  coveragePct: number;
  lastSnapshot: string | null;
  instances: RdsInstanceDetail[];
};

export type RdsProviderReport = {
  provider: string;
  totalSnapshots: number;
  totalBytes: number;
  accounts: RdsAccountDetail[];
  successfulTotal: number;
  failedTotal: number;
  inProgressTotal: number;
  successRate: number;
  failureRate: number;
};

export type RdsInformeData = {
  generatedAt: string;
  dateLabel: string;
  day: DayWindow;
  aws: RdsProviderReport;
  huawei: RdsProviderReport;
  globalSummary: {
    totalSnapshots: number;
    totalBytes: number;
    successRate: number;
    failureRate: number;
    expectedDatabases: number;
    coveredDatabases: number;
    missingDatabases: number;
    coveragePct: number;
  };
};

const OK = new Set(["COMPLETED", "AVAILABLE"]);
const FAILED = new Set(["FAILED", "ERROR"]);
const IN_PROGRESS = new Set(["IN_PROGRESS", "PROTECTING", "CREATING", "COPYING", "RESTORING"]);

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

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (OK.has(s)) return "#10b981";
  if (FAILED.has(s)) return "#ef4444";
  if (IN_PROGRESS.has(s)) return "#f59e0b";
  return "#06b6d4";
}

function statusBg(status: string): string {
  const s = status.toUpperCase();
  if (OK.has(s)) return "#f0fdf4";
  if (FAILED.has(s)) return "#fef2f2";
  if (IN_PROGRESS.has(s)) return "#fffbeb";
  return "#f0f9ff";
}

type WindowRdsRow = {
  db_instance_id: string;
  db_instance_name: string;
  engine: string;
  snapshot_id: string;
  snapshot_name: string;
  snapshot_type: string;
  status: string;
  size_bytes: number | null;
  snapshot_created_at: string | null;
  snapshot_completed_at: string | null;
  region: string;
};

function rdsCoverageOf(status: string): Coverage {
  return OK.has(status.toUpperCase()) ? "OK" : "FAILED";
}

function rdsMissingInstance(exp: ExpectedResource): RdsInstanceDetail {
  return {
    dbInstanceName: exp.resourceName,
    dbInstanceId: exp.resourceId,
    engine: "",
    totalSnapshots: 0,
    lastSnapshot: null,
    coverage: "MISSING",
    snapshots: [],
  };
}

/**
 * Informe de cumplimiento del DÍA ANTERIOR: cruza el inventario (bases de
 * datos esperadas) con los snapshots generados en la ventana de ayer.
 */
export async function generateRdsInformeData(day?: DayWindow): Promise<RdsInformeData> {
  const target = day || getPreviousDayBogota();
  const now = new Date();
  const expected = await getExpectedDatabases();

  const byAccount = new Map<string, { provider: string; accountId: string; accountName: string; expected: ExpectedResource[] }>();
  for (const exp of expected) {
    const key = accountKey(exp.provider, exp.accountId);
    let entry = byAccount.get(key);
    if (!entry) {
      entry = { provider: exp.provider, accountId: exp.accountId, accountName: exp.accountName, expected: [] };
      byAccount.set(key, entry);
    }
    entry.expected.push(exp);
  }

  const windowRes = await queryAudit<WindowRdsRow & { provider: string; account_id: string; account_name: string }>(
    `SELECT provider, account_id, account_name, db_instance_id, db_instance_name, engine, snapshot_id, snapshot_name, snapshot_type, status, size_bytes, snapshot_created_at, snapshot_completed_at, region
     FROM rds_backups
     WHERE snapshot_created_at >= $1 AND snapshot_created_at < $2
     ORDER BY provider, account_id, db_instance_id, snapshot_created_at DESC`,
    [target.startISO, target.endISO],
  );

  const windowByAccount = new Map<string, typeof windowRes.rows>();
  for (const row of windowRes.rows) {
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

  async function buildProviderReport(provider: "AWS" | "HUAWEI CLOUD"): Promise<RdsProviderReport> {
    const providerEntries = [...byAccount.values()].filter((a) => a.provider === provider);

    const accounts = providerEntries.map((acc) => {
      const rows = windowByAccount.get(accountKey(acc.provider, acc.accountId)) || [];
      const byInstance = new Map<string, WindowRdsRow[]>();
      for (const r of rows) {
        const list = byInstance.get(r.db_instance_id);
        if (list) list.push(r);
        else byInstance.set(r.db_instance_id, [r]);
      }

      const seen = new Set<string>();
      const instances: RdsInstanceDetail[] = [];
      let ok = 0;
      let failed = 0;
      let missing = 0;
      let bytes = 0;
      const engines = new Set<string>();
      let last: string | null = null;

      const toSnaps = (recs: WindowRdsRow[]): RdsSnapshotDetail[] =>
        recs.slice(0, 20).map((r) => ({
          snapshotName: r.snapshot_name || r.snapshot_id,
          snapshotId: r.snapshot_id,
          snapshotType: r.snapshot_type || "",
          status: r.status,
          sizeBytes: r.size_bytes !== null && r.size_bytes !== undefined ? Number(r.size_bytes) : null,
          snapshotCreatedAt: r.snapshot_created_at ? new Date(r.snapshot_created_at).toISOString() : null,
          snapshotCompletedAt: r.snapshot_completed_at ? new Date(r.snapshot_completed_at).toISOString() : null,
        }));

      for (const exp of acc.expected) {
        let recs = byInstance.get(exp.resourceId);
        let usedId = exp.resourceId;
        if (!recs) {
          const byName = [...byInstance.entries()].find(
            ([, v]) => (v[0].db_instance_name || "").toLowerCase() === exp.resourceName.toLowerCase(),
          );
          if (!byName) {
            instances.push(rdsMissingInstance(exp));
            missing++;
            continue;
          }
          usedId = byName[0];
          recs = byName[1];
        }
        seen.add(usedId);
        const cov: Coverage = recs.some((r) => OK.has(r.status.toUpperCase())) ? "OK" : "FAILED";
        const eng = recs[0]?.engine || "";
        if (eng) engines.add(eng);
        if (cov === "OK") {
          ok++;
          bytes += recs.filter((r) => OK.has(r.status.toUpperCase())).reduce((a, r) => a + Number(r.size_bytes || 0), 0);
        } else failed++;
        const lastRec = recs[0]?.snapshot_created_at || null;
        if (lastRec && (!last || lastRec > last)) last = lastRec;
        instances.push({
          dbInstanceName: exp.resourceName,
          dbInstanceId: exp.resourceId,
          engine: eng,
          totalSnapshots: recs.length,
          lastSnapshot: lastRec ? new Date(lastRec).toISOString() : null,
          coverage: cov,
          snapshots: toSnaps(recs),
        });
      }

      for (const [iid, recs] of byInstance) {
        if (seen.has(iid)) continue;
        const cov: Coverage = recs.some((r) => OK.has(r.status.toUpperCase())) ? "OK" : "FAILED";
        const first = recs[0];
        if (cov === "OK") bytes += recs.filter((r) => OK.has(r.status.toUpperCase())).reduce((a, r) => a + Number(r.size_bytes || 0), 0);
        if (first.engine) engines.add(first.engine);
        instances.push({
          dbInstanceName: first.db_instance_name || iid,
          dbInstanceId: iid,
          engine: first.engine || "",
          totalSnapshots: recs.length,
          lastSnapshot: first.snapshot_created_at ? new Date(first.snapshot_created_at).toISOString() : null,
          coverage: cov,
          snapshots: toSnaps(recs),
        });
      }

      instances.sort((a, b) => {
        const rank = (c: Coverage) => (c === "MISSING" ? 0 : c === "FAILED" ? 1 : 2);
        return rank(a.coverage) - rank(b.coverage) || a.dbInstanceName.localeCompare(b.dbInstanceName);
      });

      const totalSnapshots = rows.length;
      const successful = rows.filter((r) => OK.has((r.status || "").toUpperCase())).length;
      const failedCount = rows.filter((r) => FAILED.has((r.status || "").toUpperCase())).length;
      const inProgress = rows.filter((r) => IN_PROGRESS.has((r.status || "").toUpperCase())).length;
      const totalInstances = acc.expected.length;

      return {
        accountId: acc.accountId,
        accountName: acc.accountName,
        region: rows[0]?.region || "",
        totalSnapshots,
        successfulSnapshots: successful,
        failedSnapshots: failedCount,
        inProgressSnapshots: inProgress,
        engines: [...engines],
        instanceCount: totalInstances,
        missingInstances: missing,
        coveragePct: totalInstances ? Math.round((ok / totalInstances) * 100) : 0,
        lastSnapshot: last ? new Date(last).toISOString() : null,
        instances,
      };
    });

    const totalSnapshots = accounts.reduce((a, c) => a + c.totalSnapshots, 0);
    const successfulTotal = accounts.reduce((a, c) => a + c.successfulSnapshots, 0);
    const failedTotal = accounts.reduce((a, c) => a + c.failedSnapshots, 0);
    const inProgressTotal = accounts.reduce((a, c) => a + c.inProgressSnapshots, 0);
    const totalBytes = accounts.reduce(
      (a, c) => a + c.instances.filter((i) => i.coverage === "OK").reduce((x, i) => x + i.snapshots.filter((s) => OK.has(s.status.toUpperCase())).reduce((y, s) => y + (s.sizeBytes || 0), 0), 0),
      0,
    );

    return {
      provider: provider === "AWS" ? "AWS" : "Huawei Cloud",
      totalSnapshots,
      totalBytes,
      accounts,
      successfulTotal,
      failedTotal,
      inProgressTotal,
      successRate: totalSnapshots ? Math.round((successfulTotal / totalSnapshots) * 100) : 0,
      failureRate: totalSnapshots ? Math.round((failedTotal / totalSnapshots) * 100) : 0,
    };
  }

  const aws = await buildProviderReport("AWS");
  const huawei = await buildProviderReport("HUAWEI CLOUD");

  const expectedDatabases =
    aws.accounts.reduce((a, c) => a + c.instanceCount, 0) + huawei.accounts.reduce((a, c) => a + c.instanceCount, 0);
  const coveredDatabases =
    aws.accounts.reduce((a, c) => a + c.instances.filter((i) => i.coverage === "OK").length, 0) +
    huawei.accounts.reduce((a, c) => a + c.instances.filter((i) => i.coverage === "OK").length, 0);
  const globalTotal = aws.totalSnapshots + huawei.totalSnapshots;
  const globalOk = aws.successfulTotal + huawei.successfulTotal;
  const globalFailed = aws.failedTotal + huawei.failedTotal;
  const globalBytes = aws.totalBytes + huawei.totalBytes;

  return {
    generatedAt: now.toISOString(),
    dateLabel: target.label,
    day: target,
    aws,
    huawei,
    globalSummary: {
      totalSnapshots: globalTotal,
      totalBytes: globalBytes,
      successRate: globalTotal ? Math.round((globalOk / globalTotal) * 100) : 0,
      failureRate: globalTotal ? Math.round((globalFailed / globalTotal) * 100) : 0,
      expectedDatabases,
      coveredDatabases,
      missingDatabases: Math.max(0, expectedDatabases - coveredDatabases),
      coveragePct: expectedDatabases ? Math.round((coveredDatabases / expectedDatabases) * 100) : 0,
    },
  };
}

function providerGradient(provider: string): string {
  return provider === "AWS"
    ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
    : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
}

function renderProviderSection(report: RdsProviderReport): string {
  const gradient = providerGradient(report.provider);
  const providerLabel = report.provider === "AWS" ? "AWS" : "Huawei Cloud";

  const accountSections = report.accounts
    .map((acc) => {
      const missingBanner = acc.missingInstances > 0
        ? `<p style="font-size:12px;font-weight:600;color:#ef4444;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;margin:0 0 12px;">⚠ ${acc.missingInstances} base(s) de datos SIN BACKUP en esta cuenta</p>`
        : "";
      const instanceBlocks = acc.instances
        .map((inst) => {
          if (inst.coverage === "MISSING") {
            return `
      <div style="margin-bottom:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:14px;font-weight:700;color:#b91c1c;">${esc(inst.dbInstanceName)}</td>
            <td align="right"><span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:700;color:#ffffff;background:#ef4444;">SIN BACKUP</span></td>
          </tr>
        </table>
        <p style="font-size:12px;color:#b91c1c;margin:6px 0 0;">No se generó snapshot de esta base de datos el día anterior (${esc(inst.dbInstanceId)}).</p>
      </div>`;
          }
          const rows = inst.snapshots
            .map((s) => {
              const sc = statusColor(s.status);
              const sb = statusBg(s.status);
              return `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#1f2937;">${esc(s.snapshotName)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${esc(s.snapshotType || "—")}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${sc};background:${sb};">${esc(s.status)}</span></td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;white-space:nowrap;">${formatDateShort(s.snapshotCreatedAt)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;white-space:nowrap;">${s.sizeBytes !== null ? formatBytes(s.sizeBytes) : "—"}</td>
          </tr>`;
            })
            .join("");
          const more = inst.totalSnapshots > inst.snapshots.length
            ? `<p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">…y ${inst.totalSnapshots - inst.snapshots.length} snapshots anteriores.</p>`
            : "";
          return `
      <div style="margin-bottom:20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
          <tr>
            <td style="font-size:14px;font-weight:600;color:#1f2937;">${esc(inst.dbInstanceName)}</td>
            <td align="right" style="font-size:12px;color:#9ca3af;">${esc(inst.engine)} · ${inst.totalSnapshots} snapshots</td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Snapshot</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Tipo</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Estado</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Fecha</th>
              <th align="right" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Tamaño</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${more}
      </div>`;
        })
        .join("");

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
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Snapshots</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937;margin-top:2px;">${acc.totalSnapshots}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Exitosos</div>
              <div style="font-size:20px;font-weight:700;color:#10b981;margin-top:2px;">${acc.successfulSnapshots}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Fallidos</div>
              <div style="font-size:20px;font-weight:700;color:#ef4444;margin-top:2px;">${acc.failedSnapshots}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-radius:0 6px 6px 0;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Instancias</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937;margin-top:2px;">${acc.instanceCount}</div>
            </td>
          </tr>
        </table>
        ${missingBanner}
        ${instanceBlocks || `<p style="font-size:13px;color:#9ca3af;margin:0;">Sin snapshots registrados.</p>`}
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
            <span style="font-size:13px;color:rgba(255,255,255,0.8);margin-left:12px;">${report.accounts.length} cuenta(s) · ${report.totalSnapshots} snapshots · ${formatBytes(report.totalBytes)}</span>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.2);">Tasa éxito: ${report.successRate}%</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:20px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      ${accountSections}
    </div>
  </div>`;
}

export function generateRdsEmailHtml(data: RdsInformeData): string {
  const { aws, huawei, globalSummary, dateLabel } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe diario de backups de bases de datos — ${esc(dateLabel)}</title>
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
            <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Informe diario de backups de bases de datos</div>
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
      <div style="font-size:12px;color:#6b7280;margin-bottom:16px;">Cobertura: ${globalSummary.coveredDatabases}/${globalSummary.expectedDatabases} bases de datos con snapshot (${globalSummary.coveragePct}%)</div>
      ${globalSummary.missingDatabases > 0 ? `<div style="font-size:13px;font-weight:700;color:#ffffff;background:#ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;">⚠ ${globalSummary.missingDatabases} BASE(S) DE DATOS SIN BACKUP — revisar detalle en rojo</div>` : `<div style="font-size:13px;font-weight:600;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">✓ Todas las bases de datos tienen snapshot del día anterior</div>`}
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-radius:8px 0 0 8px;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Total snapshots</div>
            <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${globalSummary.totalSnapshots}</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Volumen total</div>
            <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${formatBytes(globalSummary.totalBytes)}</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Tasa de éxito</div>
            <div style="font-size:24px;font-weight:700;color:#10b981;margin-top:4px;">${globalSummary.successRate}%</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Tasa de fallo</div>
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

export function generateRdsEmailText(data: RdsInformeData): string {
  const { aws, huawei, globalSummary, dateLabel } = data;

  const lines: string[] = [];
  lines.push("MC Inventory — Informe diario de backups de bases de datos (día anterior)");
  lines.push(dateLabel);
  lines.push("");
  lines.push("=== RESUMEN EJECUTIVO ===");
  lines.push(`Total snapshots: ${globalSummary.totalSnapshots}`);
  lines.push(`Volumen total: ${formatBytes(globalSummary.totalBytes)}`);
  lines.push(`Tasa de éxito: ${globalSummary.successRate}%`);
  lines.push(`Tasa de fallo: ${globalSummary.failureRate}%`);
  lines.push(`Cobertura: ${globalSummary.coveredDatabases}/${globalSummary.expectedDatabases} bases de datos (${globalSummary.coveragePct}%)`);
  if (globalSummary.missingDatabases > 0) {
    lines.push(`!!! ${globalSummary.missingDatabases} BASE(S) DE DATOS SIN BACKUP !!!`);
  }
  lines.push("");

  function renderProvider(report: RdsProviderReport) {
    lines.push(`=== ${report.provider.toUpperCase()} ===`);
    lines.push(`Snapshots: ${report.totalSnapshots} | Volumen: ${formatBytes(report.totalBytes)} | Éxito: ${report.successRate}% | Fallo: ${report.failureRate}%`);
    lines.push("");
    for (const acc of report.accounts) {
      lines.push(`-- ${acc.accountName} (${acc.accountId}) — ${acc.region} --`);
      lines.push(`  Snapshots: ${acc.totalSnapshots} | Exitosos: ${acc.successfulSnapshots} | Fallidos: ${acc.failedSnapshots} | Sin backup: ${acc.missingInstances} | Instancias: ${acc.instanceCount}`);
      lines.push("");
      for (const inst of acc.instances) {
        const flag = inst.coverage === "MISSING" ? "[SIN BACKUP] " : inst.coverage === "FAILED" ? "[FALLIDO] " : "";
        lines.push(`  ${flag}${inst.dbInstanceName} [${inst.engine}] — ${inst.totalSnapshots} snapshots`);
        for (const s of inst.snapshots) {
          const size = s.sizeBytes !== null ? formatBytes(s.sizeBytes) : "—";
          lines.push(`    ${s.snapshotName} | ${s.snapshotType || "—"} | ${s.status} | ${formatDateShort(s.snapshotCreatedAt)} | ${size}`);
        }
        if (inst.totalSnapshots > inst.snapshots.length) {
          lines.push(`    …y ${inst.totalSnapshots - inst.snapshots.length} anteriores`);
        }
        lines.push("");
      }
    }
  }

  renderProvider(aws);
  renderProvider(huawei);

  lines.push("—");
  lines.push("UX Technology · MC Inventory");
  lines.push("Informe generado automáticamente");

  return lines.join("\n");
}

export function filterRdsInformeData(data: RdsInformeData, provider: "AWS" | "HUAWEI CLOUD"): RdsInformeData {
  const keep = provider === "AWS" ? data.aws : data.huawei;
  const empty: RdsProviderReport = {
    provider: provider === "AWS" ? "Huawei Cloud" : "AWS",
    totalSnapshots: 0,
    totalBytes: 0,
    accounts: [],
    successfulTotal: 0,
    failedTotal: 0,
    inProgressTotal: 0,
    successRate: 0,
    failureRate: 0,
  };
  const aws = provider === "AWS" ? keep : empty;
  const huawei = provider === "HUAWEI CLOUD" ? keep : empty;
  const covered = keep.accounts.reduce((a, c) => a + c.instances.filter((i) => i.coverage === "OK").length, 0);
  const expectedCount = keep.accounts.reduce((a, c) => a + c.instanceCount, 0);
  return {
    ...data,
    aws,
    huawei,
    globalSummary: {
      totalSnapshots: keep.totalSnapshots,
      totalBytes: keep.totalBytes,
      successRate: keep.successRate,
      failureRate: keep.failureRate,
      expectedDatabases: expectedCount,
      coveredDatabases: covered,
      missingDatabases: Math.max(0, expectedCount - covered),
      coveragePct: expectedCount ? Math.round((covered / expectedCount) * 100) : 0,
    },
  };
}
