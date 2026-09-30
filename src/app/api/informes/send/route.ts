import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { generateInformeData, generateEmailHtml, generateEmailText } from "@/lib/email/informe";
import { sendEmail, getSendGridConfig } from "@/lib/email/sendgrid";

export async function POST(request: Request) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;

  let provider: "all" | "AWS" | "HUAWEI CLOUD" = "all";
  try {
    const body = await request.json();
    if (body.provider === "AWS" || body.provider === "HUAWEI CLOUD") provider = body.provider;
  } catch {}

  try {
    const data = await generateInformeData();
    const config = getSendGridConfig();

    const subject = provider === "all"
      ? `Informe diario de backups — ${data.dateLabel}`
      : `Informe de backups ${provider} — ${data.dateLabel}`;

    const html = generateEmailHtml(data);
    const text = generateEmailText(data);

    const result = await sendEmail({
      to: config.recipients,
      subject,
      html,
      text,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      recipients: config.recipients,
      provider,
      subject,
      generatedAt: data.generatedAt,
      sentBy: guard.session?.user?.email || "unknown",
    });
  } catch (e: any) {
    const message = e?.cause?.code === "SELF_SIGNED_CERT_IN_CHAIN"
      ? "Error de certificado SSL (proxy corporativo). Se requiere NODE_TLS_REJECT_UNAUTHORIZED=0 en el contenedor."
      : e?.message || "Error enviando correo";
    console.error("[informes] send error:", message, e?.cause?.code || "");
    return NextResponse.json(
      { success: false, error: message, detail: e?.cause?.code || e?.code || "" },
      { status: 502 },
    );
  }
}
