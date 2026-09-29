import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { isBackupRefreshRunning, refreshBackups } from "@/lib/backups/collector";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;

  if (isBackupRefreshRunning()) {
    return NextResponse.json({ error: "A backup refresh is already running" }, { status: 409 });
  }

  try {
    const summary = await refreshBackups("manual", guard.session.user?.email || "unknown");
    await recordApiAudit(request, guard.session, {
      action: "data.backups.refresh",
      category: "data",
      result: summary.status === "error" ? "failure" : "success",
      statusCode: 200,
      startedAt,
      metadata: { status: summary.status, recordsUpserted: summary.recordsUpserted, accounts: summary.accounts.length },
    });
    return NextResponse.json({ summary });
  } catch (error: any) {
    const message = error?.message === "BACKUP_REFRESH_ALREADY_RUNNING"
      ? "A backup refresh is already running"
      : "Failed to refresh backups";
    const statusCode = error?.message === "BACKUP_REFRESH_ALREADY_RUNNING" ? 409 : 500;
    await recordApiAudit(request, guard.session, {
      action: "data.backups.refresh",
      category: "data",
      result: "error",
      statusCode,
      startedAt,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
