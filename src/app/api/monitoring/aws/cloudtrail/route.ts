import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { CloudTrailService } from "@/services/aws/cloudtrail.service";

export async function GET(request: NextRequest) {
  try {
    const guard = await requireApiSession("monitoring:view");
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

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching CloudTrail events:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch CloudTrail events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
