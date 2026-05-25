import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getCloudWatchLogs } from "@/lib/aws/cloudwatch-logs";
import { getHuaweiLogs } from "@/lib/huawei/lts";
import { getAWSAccounts } from "@/lib/aws/accounts";
import { getHuaweiAccounts } from "@/lib/huawei/accounts";
import type {
  LogEntry,
  LogFilters,
  LogsResponse,
  MonitoringMetrics,
} from "@/types/monitoring";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    const filters: LogFilters = {
      account: searchParams.get("account") || undefined,
      provider: (searchParams.get("provider") as any) || undefined,
      region: searchParams.get("region") || undefined,
      severity: (searchParams.get("severity") as any) || undefined,
      searchText: searchParams.get("searchText") || undefined,
      startTime: searchParams.get("startTime") || undefined,
      endTime: searchParams.get("endTime") || undefined,
      logGroup: searchParams.get("logGroup") || undefined,
      limit: parseInt(searchParams.get("limit") || "100"),
    };

    const allLogs: LogEntry[] = [];

    // Fetch AWS logs
    if (!filters.provider || filters.provider === "aws") {
      const awsAccounts = getAWSAccounts();
      const accountsToQuery = filters.account
        ? awsAccounts.filter((acc) => acc.name === filters.account)
        : awsAccounts;

      await Promise.all(
        accountsToQuery.map(async (account) => {
          try {
            const logs = await getCloudWatchLogs(account, filters);
            allLogs.push(...logs);
          } catch (error) {
            console.error(
              `Error fetching AWS logs for ${account.name}:`,
              error,
            );
          }
        }),
      );
    }

    // Fetch Huawei logs
    if (!filters.provider || filters.provider === "huawei") {
      const huaweiAccounts = getHuaweiAccounts();
      const accountsToQuery = filters.account
        ? huaweiAccounts.filter((acc) => acc.name === filters.account)
        : huaweiAccounts;

      await Promise.all(
        accountsToQuery.map(async (account) => {
          try {
            const logs = await getHuaweiLogs(account, filters);
            allLogs.push(...logs);
          } catch (error) {
            console.error(
              `Error fetching Huawei logs for ${account.name}:`,
              error,
            );
          }
        }),
      );
    }

    // Sort all logs by timestamp
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply final limit
    const limitedLogs = allLogs.slice(0, filters.limit);

    // Calculate metrics
    const metrics = {
      totalLogs: allLogs.length,
      errorCount: allLogs.filter(log =>
        ['ERROR', 'CRITICAL'].includes(log.severity.toUpperCase())
      ).length,
      warnCount: allLogs.filter(log =>
        ['WARNING', 'WARN'].includes(log.severity.toUpperCase())
      ).length,
      infoCount: allLogs.filter(log =>
        log.severity.toUpperCase() === 'INFO'
      ).length,
    };

    const response: LogsResponse = {
      logs: limitedLogs,
      total: allLogs.length,
      metrics,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Logs API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs", details: error?.message },
      { status: 500 },
    );
  }
}

// Get monitoring metrics
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch recent logs for metrics
    const filters: LogFilters = {
      limit: 500,
      startTime: new Date(Date.now() - 3600000).toISOString(), // Last hour
    };

    const allLogs: LogEntry[] = [];

    // Fetch from all accounts
    const awsAccounts = getAWSAccounts();
    const huaweiAccounts = getHuaweiAccounts();

    await Promise.all([
      ...awsAccounts.map(async (account) => {
        try {
          const logs = await getCloudWatchLogs(account, filters);
          allLogs.push(...logs);
        } catch (error) {
          console.error(`Error fetching AWS logs for metrics:`, error);
        }
      }),
      ...huaweiAccounts.map(async (account) => {
        try {
          const logs = await getHuaweiLogs(account, filters);
          allLogs.push(...logs);
        } catch (error) {
          console.error(`Error fetching Huawei logs for metrics:`, error);
        }
      }),
    ]);

    // Calculate metrics
    const totalLogs = allLogs.length;
    const errorCount = allLogs.filter((log) =>
      ['ERROR', 'CRITICAL'].includes(log.severity.toUpperCase())
    ).length;
    const warnCount = allLogs.filter((log) =>
      ['WARNING', 'WARN'].includes(log.severity.toUpperCase())
    ).length;
    const infoCount = allLogs.filter((log) =>
      log.severity.toUpperCase() === 'INFO'
    ).length;

    const metrics: MonitoringMetrics = {
      totalLogs,
      errorCount,
      warnCount,
      infoCount,
    };

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Metrics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics", details: error?.message },
      { status: 500 },
    );
  }
}
