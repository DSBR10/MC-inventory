import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { recordApiAudit } from "@/lib/audit/server";
import { generateInformeData, generateEmailHtml, generateEmailText, filterInformeData } from "@/lib/email/informe";
import { generateRdsInformeData, generateRdsEmailHtml, generateRdsEmailText, filterRdsInformeData } from "@/lib/email/informe-rds";
import { generateLogsInformeData, generateLogsEmailHtml, generateLogsEmailText, filterLogsInformeData } from "@/lib/email/informe-logs";
import { sendEmail, getSendGridConfig } from "@/lib/email/sendgrid";
import { isValidEmail, normalizeEmail } from "@/lib/email/recipients";

export type ReportType = "servers" | "rds" | "logs";

const REPORT_SUBJECTS: Record<ReportType, string> = {
  servers: "Informe diario de backups de servidores",
  rds: "Informe diario de backups de bases de datos",
  logs: "Informe diario de backups de logs transaccionales",
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;

  let provider: "all" | "AWS" | "HUAWEI CLOUD" = "all";
  let reportType: ReportType = "servers";
  let adHocRecipients: string[] | undefined;
  try {
    const body = (await request.json()) as { provider?: unknown; recipients?: unknown; reportType?: unknown };
    if (body.provider === "AWS" || body.provider === "HUAWEI CLOUD") provider = body.provider;
    if (body.reportType === "rds" || body.reportType === "logs" || body.reportType === "servers") reportType = body.reportType;
    if (Array.isArray(body.recipients)) {
      const cleaned: string[] = [...new Set(
        (body.recipients as unknown[]).map((r) => normalizeEmail(String(r ?? ""))),
      )].filter((r: string) => isValidEmail(r)).slice(0, 50);
      if (cleaned.length > 0) adHocRecipients = cleaned;
    }
  } catch {}

  try {
    let subject: string;
    let html: string;
    let text: string;
    let generatedAt: string;
    let total: number;
    let dateLabel: string;

    if (reportType === "rds") {
      const full = await generateRdsInformeData();
      const data = provider === "all" ? full : filterRdsInformeData(full, provider);
      html = generateRdsEmailHtml(data);
      text = generateRdsEmailText(data);
      generatedAt = data.generatedAt;
      dateLabel = data.dateLabel;
      total = data.globalSummary.totalSnapshots;
    } else if (reportType === "logs") {
      const full = await generateLogsInformeData();
      const data = provider === "all" ? full : filterLogsInformeData(full, provider);
      html = generateLogsEmailHtml(data);
      text = generateLogsEmailText(data);
      generatedAt = data.generatedAt;
      dateLabel = data.dateLabel;
      total = data.globalSummary.totalEntries;
    } else {
      const full = await generateInformeData();
      const data = provider === "all" ? full : filterInformeData(full, provider);
      html = generateEmailHtml(data);
      text = generateEmailText(data);
      generatedAt = data.generatedAt;
      dateLabel = data.dateLabel;
      total = data.globalSummary.totalBackups;
    }

    subject = provider === "all"
      ? `${REPORT_SUBJECTS[reportType]} — ${dateLabel}`
      : `${REPORT_SUBJECTS[reportType]} ${provider === "AWS" ? "AWS" : "Huawei"} — ${dateLabel}`;

    const config = await getSendGridConfig();
    // Destinatarios ad-hoc (escritos en el momento) o los efectivos (BD > .env).
    const recipients = adHocRecipients || config.recipients;

    const result = await sendEmail({
      to: recipients,
      subject,
      html,
      text,
    });

    await recordApiAudit(request, guard.session, {
      action: "informes.send",
      category: "export",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: {
        reportType,
        provider,
        recipients,
        recipientsSource: adHocRecipients ? "ad-hoc" : config.recipientsSource,
        messageId: result.messageId,
        total,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      recipients,
      recipientsSource: adHocRecipients ? "ad-hoc" : config.recipientsSource,
      reportType,
      provider,
      subject,
      generatedAt,
      sentBy: guard.session?.user?.email || "unknown",
    });
  } catch (e: any) {
    const message = e?.cause?.code === "SELF_SIGNED_CERT_IN_CHAIN"
      ? "Error de certificado SSL (proxy corporativo). Se requiere NODE_TLS_REJECT_UNAUTHORIZED=0 en el contenedor."
      : e?.message || "Error enviando correo";
    console.error("[informes] send error:", message, e?.cause?.code || "");
    await recordApiAudit(request, guard.session, {
      action: "informes.send",
      category: "export",
      result: "error",
      statusCode: 502,
      startedAt,
      metadata: { reportType, provider, error: message },
    });
    return NextResponse.json(
      { success: false, error: message, detail: e?.cause?.code || e?.code || "" },
      { status: 502 },
    );
  }
}
