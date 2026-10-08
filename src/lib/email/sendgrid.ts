import { resolveSecret } from "@/lib/secrets/crypto";
import { getEffectiveRecipients, type RecipientsSource } from "@/lib/email/recipients";

type SendGridConfig = {
  apiKey: string;
  senderEmail: string;
  recipients: string[];
  recipientsSource: RecipientsSource;
};

export async function getSendGridConfig(): Promise<SendGridConfig> {
  const apiKey = resolveSecret(process.env.SENDGRID_API_KEY, { label: "SENDGRID_API_KEY" });
  const senderEmail = resolveSecret(process.env.SENDGRID_SENDER_EMAIL, { label: "SENDGRID_SENDER_EMAIL" });

  if (!apiKey || !senderEmail) {
    throw new Error("SendGrid no configurado: falta SENDGRID_API_KEY o SENDGRID_SENDER_EMAIL");
  }

  // Los destinatarios viven en la BD (gestionables desde /informes);
  // SENDGRID_RECIPIENTS en texto plano queda como respaldo.
  const { emails: recipients, source: recipientsSource } = await getEffectiveRecipients();

  return { apiKey, senderEmail, recipients, recipientsSource };
}

export async function isSendGridConfigured(): Promise<boolean> {
  try {
    const config = await getSendGridConfig();
    return !!config.apiKey && !!config.senderEmail && config.recipients.length > 0;
  } catch {
    return false;
  }
}

export async function getSenderEmail(): Promise<string> {
  return resolveSecret(process.env.SENDGRID_SENDER_EMAIL, { label: "SENDGRID_SENDER_EMAIL" });
}

export async function sendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string }> {
  const config = await getSendGridConfig();

  if (params.to.length === 0) {
    throw new Error("Sin destinatarios: agrega correos en el módulo Informes o configura SENDGRID_RECIPIENTS");
  }

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
