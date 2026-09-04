import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { getAWSAccounts } from "@/lib/aws/aws-accounts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
    if (guard.response) return guard.response;

    const accounts = getAWSAccounts();

    // Return only safe information (without credentials)
    const safeAccounts = accounts.map((acc) => ({
      name: acc.name,
      id: acc.id,
      region: acc.region,
    }));

    await recordApiAudit(request, guard.session, {
      action: "monitoring.aws.accounts.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { accountCount: safeAccounts.length },
    });
    return NextResponse.json({
      success: true,
      accounts: safeAccounts,
    });
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.accounts.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch AWS accounts" },
      { status: 500 },
    );
  }
}
