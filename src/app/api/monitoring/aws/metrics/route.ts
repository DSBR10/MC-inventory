import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { CloudWatchMetricsService } from "@/services/aws/cloudwatch-metrics.service";
import { getAWSAccountById, getDefaultAWSAccount } from "@/lib/aws/aws-accounts";

export async function GET(request: NextRequest) {
  try {
    const guard = await requireApiSession("monitoring:view");
    if (guard.response) return guard.response;

    const searchParams = request.nextUrl.searchParams;
    const serviceType = searchParams.get("serviceType"); // ec2, rds, ecs
    const resourceId = searchParams.get("resourceId");
    const accountId = searchParams.get("accountId");
    const region = searchParams.get("region") || "us-east-1";
    const period = parseInt(searchParams.get("period") || "300");

    if (!serviceType || !resourceId) {
      return NextResponse.json(
        { error: "serviceType and resourceId are required" },
        { status: 400 },
      );
    }

    const account = accountId ? getAWSAccountById(accountId) : getDefaultAWSAccount();

    if (!account) {
      return NextResponse.json(
        { error: "AWS account not found" },
        { status: 404 },
      );
    }

    const metricsService = new CloudWatchMetricsService(region, {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    });
    let metrics;

    switch (serviceType) {
      case "ec2":
        metrics = await metricsService.getEC2Metrics(resourceId, period);
        break;
      case "rds":
        metrics = await metricsService.getRDSMetrics(resourceId, period);
        break;
      case "ecs":
        const serviceName = searchParams.get("serviceName");
        if (!serviceName) {
          return NextResponse.json(
            { error: "serviceName is required for ECS" },
            { status: 400 },
          );
        }
        metrics = await metricsService.getECSMetrics(
          resourceId,
          serviceName,
          period,
        );
        break;
      default:
        return NextResponse.json(
          { error: "Invalid serviceType. Use: ec2, rds, or ecs" },
          { status: 400 },
        );
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Error fetching AWS metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch metrics",
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
    const { namespace, region, accountId } = body;

    if (!namespace) {
      return NextResponse.json(
        { error: "namespace is required" },
        { status: 400 },
      );
    }

    const account = accountId ? getAWSAccountById(accountId) : getDefaultAWSAccount();

    if (!account) {
      return NextResponse.json(
        { error: "AWS account not found" },
        { status: 404 },
      );
    }

    const metricsService = new CloudWatchMetricsService(region, {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    });
    const availableMetrics = await metricsService.listMetrics(namespace);

    return NextResponse.json({ metrics: availableMetrics });
  } catch (error) {
    console.error("Error listing metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to list metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
