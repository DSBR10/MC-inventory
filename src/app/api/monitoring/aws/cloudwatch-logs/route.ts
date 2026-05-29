import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { CloudWatchLogsService } from "@/services/aws/cloudwatch-logs.service";

export async function GET(request: NextRequest) {
  try {
    const guard = await requireApiSession("monitoring:view");
    if (guard.response) return guard.response;

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");
    const logGroupName = searchParams.get("logGroupName");
    const region = searchParams.get("region") || "us-east-1";
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const filterPattern = searchParams.get("filterPattern") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");

    const { getAWSAccountById, getDefaultAWSAccount } = await import("@/lib/aws/aws-accounts");
    const account = accountId ? getAWSAccountById(accountId) : getDefaultAWSAccount();

    if (!account) {
      return NextResponse.json(
        { error: "AWS account not found" },
        { status: 404 },
      );
    }

    const logsService = new CloudWatchLogsService(region, {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    });

    if (!logGroupName) {
      // Si no se proporciona logGroupName, listar todos los log groups
      const logGroups = await logsService.listLogGroups();
      return NextResponse.json({ logGroups });
    }

    // Obtener logs del log group específico
    const logs = await logsService.getLogs(
      logGroupName,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
      filterPattern,
      limit,
    );

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching CloudWatch logs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch logs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireApiSession("monitoring:view");
    if (guard.response) return guard.response;

    const body = await request.json();
    const { logGroupName, region } = body;

    if (!logGroupName) {
      return NextResponse.json(
        { error: "logGroupName is required" },
        { status: 400 },
      );
    }

    const logsService = new CloudWatchLogsService(region || "us-east-1");
    const logStreams = await logsService.listLogStreams(logGroupName);

    return NextResponse.json({ logStreams });
  } catch (error) {
    console.error("Error listing log streams:", error);
    return NextResponse.json(
      {
        error: "Failed to list log streams",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
