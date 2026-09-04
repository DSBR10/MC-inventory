import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { requireApiSession } from "@/lib/auth/server";
import { recordApiAudit } from "@/lib/audit/server";

export const runtime = "nodejs";

const filePath = path.join(process.cwd(), "data/inventory-meta.json");

function readDB() {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeDB(data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("inventory:modify", req);
    if (guard.response) return guard.response;

    const { id, description, internalSoftwares } = await req.json();

    const db = readDB();

    db[id] = {
      ...(db[id] || {}),
      description,
      internalSoftwares,
    };

    writeDB(db);

    await recordApiAudit(req, guard.session, {
      action: "inventory.meta.update",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { resourceId: typeof id === "string" ? id.slice(0, 128) : "unknown" },
    });
    return NextResponse.json({ success: true });
  } catch {
    const sessionGuard = await requireApiSession(undefined, req);
    if (sessionGuard.session) {
      await recordApiAudit(req, sessionGuard.session, {
        action: "inventory.meta.update",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
