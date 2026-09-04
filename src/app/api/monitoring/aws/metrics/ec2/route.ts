import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { getEC2Metrics } from "@/lib/aws/cloudwatch-metrics";
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
    const instanceIds = searchParams.get("instanceIds")?.split(",") || [];
    const accountNameOrId = searchParams.get("account");

    if (instanceIds.length === 0) {
      return NextResponse.json(
        { error: "instanceIds parameter is required" },
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

    const metrics = await getEC2Metrics(account, instanceIds);

    await recordApiAudit(request, guard.session, {
      action: "monitoring.aws.ec2_metrics.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { instanceCount: instanceIds.length },
    });
    return NextResponse.json({ metrics });
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.ec2_metrics.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch EC2 metrics" },
      { status: 500 },
    );
  }
}
