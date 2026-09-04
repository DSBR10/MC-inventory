import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { getRDSMetrics } from "@/lib/aws/cloudwatch-metrics";
import {
  getAWSAccountByNameOrId,
  getDefaultAWSAccount,
} from "@/lib/aws/aws-accounts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const dbInstanceIds = searchParams.get("dbInstanceIds")?.split(",") || [];
    const accountNameOrId = searchParams.get("account");

    if (dbInstanceIds.length === 0) {
      return NextResponse.json(
        { error: "dbInstanceIds parameter is required" },
        { status: 400 },
      );
    }

    // Get AWS account credentials
    let account;
    if (accountNameOrId) {
      account = getAWSAccountByNameOrId(accountNameOrId);
      if (!account) {
        return NextResponse.json(
          { error: "AWS account not found" },
          { status: 404 },
        );
      }
    } else {
      account = getDefaultAWSAccount();
      if (!account) {
        return NextResponse.json(
          { error: "No AWS accounts configured" },
          { status: 500 },
        );
      }
    }

    const metrics = await getRDSMetrics(account, dbInstanceIds);

    await recordApiAudit(request, guard.session, {
      action: "monitoring.aws.rds_metrics.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { databaseCount: dbInstanceIds.length },
    });
    return NextResponse.json({ metrics });
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.rds_metrics.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch RDS metrics" },
      { status: 500 },
    );
  }
}
