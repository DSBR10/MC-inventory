import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { CloudTrailService } from "@/services/aws/cloudtrail.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
    if (guard.response) return guard.response;

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");
    const region = searchParams.get("region") || "us-east-1";
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const username = searchParams.get("username") || undefined;
    const resourceType = searchParams.get("resourceType") || undefined;
    const eventName = searchParams.get("eventName") || undefined;
    const maxResults = parseInt(searchParams.get("maxResults") || "50");

    const { getAWSAccountById, getDefaultAWSAccount } = await import("@/lib/aws/aws-accounts");
    const account = accountId ? getAWSAccountById(accountId) : getDefaultAWSAccount();

    if (!account) {
      return NextResponse.json(
        { error: "AWS account not found" },
        { status: 404 },
      );
    }

    const cloudTrailService = new CloudTrailService(region, {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    });

    const events = await cloudTrailService.getEvents(
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
      username,
      resourceType,
      eventName,
      maxResults,
    );

    await recordApiAudit(request, guard.session, {
      action: "monitoring.aws.cloudtrail.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { eventCount: events.length },
    });
    return NextResponse.json({ events });
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.cloudtrail.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      {
        error: "Failed to fetch CloudTrail events",
      },
      { status: 500 },
    );
  }
}
