import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/server";
import { recordApiAudit } from "@/lib/audit/server";

import {
  addExpectedLogServer,
  listExpectedLogServers,
  removeExpectedLogServer,
} from "@/lib/email/compliance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("inventory:view", request);
    if (guard.response) return guard.response;
    const items = await listExpectedLogServers();
    await recordApiAudit(request, guard.session, {
      action: "inventory.view",
      result: "success",
      statusCode: 200,
      startedAt,
    });
    return NextResponse.json({ data: items });
  } catch {
    return NextResponse.json({ error: "Error fetching expected log servers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("inventory:modify", request);
    if (guard.response) return guard.response;
    const body = await request.json();
    await addExpectedLogServer({
      provider: body.provider,
      accountId: body.accountId,
      accountName: body.accountName,
      serverName: body.serverName,
      bucketName: body.bucketName,
      createdBy: guard.session?.user?.email || "unknown",
    });
    await recordApiAudit(request, guard.session, {
      action: "inventory.modify",
      result: "success",
      statusCode: 200,
      startedAt,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error saving expected log server" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("inventory:modify", request);
    if (guard.response) return guard.response;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await removeExpectedLogServer(id);
    await recordApiAudit(request, guard.session, {
      action: "inventory.modify",
      result: "success",
      statusCode: 200,
      startedAt,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error deleting expected log server" }, { status: 500 });
  }
}
