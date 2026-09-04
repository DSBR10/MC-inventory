import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { CloudWatchLogsService } from "@/services/aws/cloudwatch-logs.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
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
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.cloudwatch_logs.view",
        result: "success",
        statusCode: 200,
        startedAt,
        metadata: { logGroupCount: logGroups.length },
      });
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

    await recordApiAudit(request, guard.session, {
      action: "monitoring.aws.cloudwatch_logs.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { logCount: logs.length },
    });
    return NextResponse.json({ logs });
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.cloudwatch_logs.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      {
        error: "Failed to fetch logs",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
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

    await recordApiAudit(request, guard.session, {
      action: "monitoring.aws.cloudwatch_logs.streams",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { streamCount: logStreams.length },
    });
    return NextResponse.json({ logStreams });
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.aws.cloudwatch_logs.streams",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      {
        error: "Failed to list log streams",
      },
      { status: 500 },
    );
  }
}
