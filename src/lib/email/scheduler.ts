import { getBogotaNow } from "@/lib/backups/scheduler";
import { isBackupRefreshRunning, refreshBackups } from "@/lib/backups/collector";
import { generateInformeData, generateEmailHtml, generateEmailText } from "@/lib/email/informe";
import { generateRdsInformeData, generateRdsEmailHtml, generateRdsEmailText } from "@/lib/email/informe-rds";
import { generateLogsInformeData, generateLogsEmailHtml, generateLogsEmailText } from "@/lib/email/informe-logs";
import { isSendGridConfigured, sendEmail, getSendGridConfig } from "@/lib/email/sendgrid";
import { queryAudit } from "@/lib/db/pool";

declare global {
  var __mcInventoryInformeScheduler: boolean | undefined;
}

function getInformeScheduleHour(): number {
  const raw = Number(process.env.INFORMES_SCHEDULE_HOUR || 7);
  if (!Number.isInteger(raw) || raw < 0 || raw > 23) return 7;
  return raw;
}

async function getLastInformeDateBogota(): Promise<string | null> {
  try {
    const res = await queryAudit(
      `SELECT sent_at FROM informe_send_log ORDER BY sent_at DESC LIMIT 1`,
    );
    if (!res.rows[0]) return null;
    const d = new Date(res.rows[0].sent_at);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch (err: any) {
    // Database unavailable — skip this tick, don't crash the scheduler
    console.error("[informes] could not query last send date:", err?.message || err);
    return null;
  }
}

async function logInformeSend(status: string, details: unknown): Promise<void> {
  try {
    await queryAudit(
      `INSERT INTO informe_send_log (status, details) VALUES ($1, $2)`,
      [status, JSON.stringify(details || {})],
    );
  } catch (err: any) {
    // Table is created by migration 009; if INSERT fails the DB is likely
    // unavailable. Log the error but don't crash the scheduler.
    console.error("[informes] could not log send:", err?.message || err);
  }
}

type ScheduledReport =
  | { type: "servers" | "rds" | "logs"; subject: string; html: string; text: string; total: number; dateLabel: string };

async function tick(): Promise<void> {
  try {
    if (!(await isSendGridConfigured())) return;

    const { hour, day } = getBogotaNow();
    if (hour < getInformeScheduleHour()) return;

    const lastDay = await getLastInformeDateBogota();
    if (lastDay === day) return;

    // Refresco previo: garantiza que el correo de las 07:00 lleve los datos
    // de ayer recién recolectados (la ventana de backups cierra a las 04:00).
    if (isBackupRefreshRunning()) {
      console.log("[informes] backup refresh in progress, retry next tick");
      return;
    }
    console.log(`[informes] scheduled backups refresh start (Bogota ${day})`);
    await refreshBackups("scheduled", "informe-scheduler");
    console.log(`[informes] scheduled backups refresh done (Bogota ${day})`);

    console.log(`[informes] scheduled send start (Bogota ${day})`);

    const config = await getSendGridConfig();
    const reports: ScheduledReport[] = [];

    const servers = await generateInformeData();
    reports.push({
      type: "servers",
      subject: `Informe diario de backups de servidores — ${servers.dateLabel}`,
      html: generateEmailHtml(servers),
      text: generateEmailText(servers),
      total: servers.globalSummary.totalBackups,
      dateLabel: servers.dateLabel,
    });

    const rds = await generateRdsInformeData();
    reports.push({
      type: "rds",
      subject: `Informe diario de backups de bases de datos — ${rds.dateLabel}`,
      html: generateRdsEmailHtml(rds),
      text: generateRdsEmailText(rds),
      total: rds.globalSummary.totalSnapshots,
      dateLabel: rds.dateLabel,
    });

    const logs = await generateLogsInformeData();
    reports.push({
      type: "logs",
      subject: `Informe diario de backups de logs transaccionales — ${logs.dateLabel}`,
      html: generateLogsEmailHtml(logs),
      text: generateLogsEmailText(logs),
      total: logs.globalSummary.totalEntries,
      dateLabel: logs.dateLabel,
    });

    let sent = 0;
    let skipped = 0;
    for (const report of reports) {
      if (report.total === 0) {
        console.log(`[informes] scheduled skip: sin datos (${report.subject})`);
        skipped++;
        continue;
      }
      const result = await sendEmail({
        to: config.recipients,
        subject: report.subject,
        html: report.html,
        text: report.text,
      });
      await logInformeSend(result.success ? "success" : "error", {
        reportType: report.type,
        messageId: result.messageId,
        recipients: config.recipients,
        total: report.total,
        dateLabel: report.dateLabel,
      });
      if (result.success) sent++;
    }

    // Marca el día como procesado aunque todo se haya omitido por falta de datos,
    // para no reintentar cada 5 minutos.
    await logInformeSend(sent > 0 ? "success" : "partial", {
      scheduled: true,
      sent,
      skipped,
      recipients: config.recipients,
    });

    console.log(`[informes] scheduled send done: ${sent} enviados, ${skipped} omitidos (sin datos)`);
  } catch (error) {
    console.error("[informes] scheduled send error:", error instanceof Error ? error.message : error);
    await logInformeSend("error", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function startInformeScheduler(): void {
  if (globalThis.__mcInventoryInformeScheduler) return;
  globalThis.__mcInventoryInformeScheduler = true;
  setInterval(tick, 5 * 60 * 1000).unref?.();
  setTimeout(tick, 2 * 60 * 1000).unref?.();
  console.log("[informes] scheduler started (daily, America/Bogota)");
}
