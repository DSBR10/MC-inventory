import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { recordApiAudit } from "@/lib/audit/server";
import { queryAudit } from "@/lib/db/pool";
import {
  addRecipient,
  getEffectiveRecipients,
  isValidEmail,
  listRecipients,
  normalizeEmail,
  removeRecipient,
  setRecipientActive,
} from "@/lib/email/recipients";
import { getSenderEmail } from "@/lib/email/sendgrid";

// GET: lista + origen efectivo + remitente + últimos envíos (requiere ver inventario)
export async function GET(request: Request) {
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  const [recipients, effective] = await Promise.all([listRecipients(), getEffectiveRecipients()]);
  const sender = await getSenderEmail().catch(() => "");

  let recentSends: Array<{ sentAt: string; status: string; details: unknown }> = [];
  try {
    const res = await queryAudit(
      `SELECT sent_at, status, details FROM informe_send_log ORDER BY sent_at DESC LIMIT 5`,
    );
    recentSends = res.rows.map((r) => ({
      sentAt: new Date(r.sent_at).toISOString(),
      status: String(r.status),
      details: r.details || {},
    }));
  } catch {}

  return NextResponse.json({
    recipients,
    effectiveRecipients: effective.emails,
    source: effective.source,
    senderEmail: sender,
    recentSends,
  });
}

// POST: agregar { email, name? } (requiere modificar inventario)
export async function POST(request: Request) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;

  let email = "";
  let name = "";
  try {
    const body = await request.json();
    email = normalizeEmail(String(body?.email || ""));
    name = String(body?.name || "");
  } catch {}

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  const recipient = await addRecipient(email, name, guard.session?.user?.email || "unknown");
  await recordApiAudit(request, guard.session, {
    action: "informes.recipient.add",
    category: "configuration",
    result: "success",
    statusCode: 201,
    startedAt,
    metadata: { email: recipient.email },
  });
  return NextResponse.json({ recipient }, { status: 201 });
}

// PATCH: activar/desactivar { id, active }
export async function PATCH(request: Request) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;

  let id = "";
  let active = true;
  try {
    const body = await request.json();
    id = String(body?.id || "");
    active = body?.active !== false;
  } catch {}

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const recipient = await setRecipientActive(id, active);
  if (!recipient) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await recordApiAudit(request, guard.session, {
    action: "informes.recipient.toggle",
    category: "configuration",
    result: "success",
    statusCode: 200,
    startedAt,
    metadata: { email: recipient.email, active },
  });
  return NextResponse.json({ recipient });
}

// DELETE: ?id= — eliminar
export async function DELETE(request: Request) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const removed = await removeRecipient(id);
  if (!removed) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await recordApiAudit(request, guard.session, {
    action: "informes.recipient.remove",
    category: "configuration",
    result: "success",
    statusCode: 200,
    startedAt,
    metadata: { id },
  });
  return NextResponse.json({ ok: true });
}
