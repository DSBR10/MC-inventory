import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { requireApiSession } from "@/lib/auth/server";

const filePath = path.join(process.cwd(), "data/inventory-meta.json");

function readDB() {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeDB(data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApiSession("inventory:modify");
    if (guard.response) return guard.response;

    const { id, description, internalSoftwares } = await req.json();

    const db = readDB();

    db[id] = {
      ...(db[id] || {}),
      description,
      internalSoftwares,
    };

    writeDB(db);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
