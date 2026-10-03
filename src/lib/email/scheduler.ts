import { getBogotaNow } from "@/lib/backups/scheduler";
import { generateInformeData, generateEmailHtml, generateEmailText } from "@/lib/email/informe";
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

async function tick(): Promise<void> {
  try {
    if (!isSendGridConfigured()) return;

    const { hour, day } = getBogotaNow();
    if (hour < getInformeScheduleHour()) return;

    const lastDay = await getLastInformeDateBogota();
    if (lastDay === day) return;

    console.log(`[informes] scheduled send start (Bogota ${day})`);

    const data = await generateInformeData();
    const config = getSendGridConfig();
    const html = generateEmailHtml(data);
    const text = generateEmailText(data);

    const result = await sendEmail({
      to: config.recipients,
      subject: `Informe diario de backups — ${data.dateLabel}`,
      html,
      text,
    });

    await logInformeSend(result.success ? "success" : "error", {
      messageId: result.messageId,
      recipients: config.recipients,
      totalBackups: data.globalSummary.totalBackups,
      successRate: data.globalSummary.successRate,
    });

    console.log(`[informes] scheduled send done: ${result.success ? "ok" : "failed"}`);
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
