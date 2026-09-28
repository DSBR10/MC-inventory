import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

import {
  getRequestContext,
  hasAuditHashSecret,
  hashAuditValue,
  recordApiAudit,
  recordAuditEvent,
} from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";

export const runtime = "nodejs";

const filePath = path.join(process.cwd(), "data/inventory-meta.json");
const safeResourceId = /^[A-Za-z0-9_.:/-]{1,512}$/;

function readDB(): Record<string, Record<string, unknown>> {
  if (!fs.existsSync(filePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function writeDB(data: Record<string, Record<string, unknown>>) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:modify", req);
  if (guard.response) return guard.response;
  const context = getRequestContext(req);

  if (!hasAuditHashSecret()) {
    await recordApiAudit(req, guard.session, {
      action: "data.inventory_meta.update",
      category: "data",
      result: "error",
      statusCode: 503,
      startedAt,
      metadata: { code: "audit_hash_unavailable" },
    });
    return NextResponse.json({ error: "Audit service unavailable" }, { status: 503 });
  }

  try {
    const body = await req.json() as { id?: unknown; description?: unknown; internalSoftwares?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const description = typeof body.description === "string" ? body.description.slice(0, 10_000) : "";
    const internalSoftwares = typeof body.internalSoftwares === "string" ? body.internalSoftwares.slice(0, 10_000) : "";
    if (!safeResourceId.test(id)) {
      await recordApiAudit(req, guard.session, {
        action: "data.inventory_meta.update",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_resource_id" },
      });
      return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
    }

    const db = readDB();
    const previous = db[id] || {};
    const next = {
      ...previous,
      description,
      internalSoftwares,
    };

    // Intención durable: si el archivo falla, existe evidencia de un intento de escritura.
    await recordAuditEvent({
      request: req,
      context,
      session: guard.session,
      action: "data.inventory_meta.update_requested",
      category: "data",
      result: "success",
      statusCode: 202,
      durationMs: Date.now() - startedAt,
      targetType: "inventory_resource",
      targetId: id,
      operationId: context.requestId,
      metadata: {
        fields: ["description", "internalSoftwares"],
        previousDescriptionHash: hashAuditValue(String(previous.description || "")),
        nextDescriptionHash: hashAuditValue(description),
      },
    });

    writeDB({ ...db, [id]: next });
    await recordAuditEvent({
      request: req,
      context,
      session: guard.session,
      action: "data.inventory_meta.updated",
      category: "data",
      result: "success",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      targetType: "inventory_resource",
      targetId: id,
      operationId: context.requestId,
      metadata: {
        fields: ["description", "internalSoftwares"],
        descriptionLength: description.length,
        internalSoftwaresLength: internalSoftwares.length,
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    await recordApiAudit(req, guard.session, {
      action: "data.inventory_meta.update",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "update_failed" },
    });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
