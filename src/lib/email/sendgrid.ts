import { resolveSecret } from "@/lib/secrets/crypto";

type SendGridConfig = {
  apiKey: string;
  senderEmail: string;
  recipients: string[];
};

export function getSendGridConfig(): SendGridConfig {
  const apiKey = resolveSecret(process.env.SENDGRID_API_KEY, { label: "SENDGRID_API_KEY" });
  const senderEmail = resolveSecret(process.env.SENDGRID_SENDER_EMAIL, { label: "SENDGRID_SENDER_EMAIL" });
  const recipientsRaw = resolveSecret(process.env.SENDGRID_RECIPIENTS, { label: "SENDGRID_RECIPIENTS" });

  if (!apiKey || !senderEmail) {
    throw new Error("SendGrid no configurado: falta SENDGRID_API_KEY o SENDGRID_SENDER_EMAIL");
  }

  const recipients = recipientsRaw
    ? recipientsRaw.split(",").map((r) => r.trim()).filter(Boolean)
    : [];

  return { apiKey, senderEmail, recipients };
}

export function isSendGridConfigured(): boolean {
  try {
    const config = getSendGridConfig();
    return !!config.apiKey && !!config.senderEmail && config.recipients.length > 0;
  } catch {
    return false;
  }
}

export async function sendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string }> {
  const config = getSendGridConfig();

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: config.senderEmail, name: "MC Inventory — Informes" },
      personalizations: params.to.map((email) => ({ to: [{ email }] })),
      subject: params.subject,
      content: [
        { type: "text/plain", value: params.text || "" },
        { type: "text/html", value: params.html },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${body}`);
  }

  return { success: true, messageId: response.headers.get("X-Message-Id") || undefined };
}
