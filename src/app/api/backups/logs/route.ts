import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { getLogBackupSummary, listLogBackups } from "@/lib/backups/repository-extended";
import { getLastRefresh } from "@/lib/backups/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  try {
    const params = request.nextUrl.searchParams;
    const page = Number(params.get("page") || 1);
    const pageSize = Number(params.get("pageSize") || 50);
    const { records, total } = await listLogBackups({
      provider: params.get("provider") || undefined,
      accountId: params.get("accountId") || undefined,
      status: params.get("status") || undefined,
      backupDate: params.get("backupDate") || undefined,
      search: params.get("search") || undefined,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    });
    const [summary, lastRefresh] = await Promise.all([getLogBackupSummary(), getLastRefresh()]);
    await recordApiAudit(request, guard.session, {
      action: "data.backups.logs.read",
      category: "data",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { returned: records.length, total },
    });
    return NextResponse.json({ records, total, page, pageSize, summary, lastRefresh });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.backups.logs.read",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
    });
    return NextResponse.json({ error: "Failed to load log backups" }, { status: 500 });
  }
}
