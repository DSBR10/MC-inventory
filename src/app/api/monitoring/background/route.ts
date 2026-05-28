import { NextRequest, NextResponse } from "next/server";
import {
  startMonitoringBackgroundJob,
  stopMonitoringBackgroundJob,
  getBackgroundJobStatus,
  refreshMonitoringCache,
} from "@/lib/monitoring/background";
import { readMonitoringCache, getCacheAge } from "@/lib/monitoring/cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cache = readMonitoringCache();
    const status = getBackgroundJobStatus();

    return NextResponse.json({
      success: true,
      status,
      cache: cache
        ? {
            exists: true,
            timestamp: cache.timestamp,
            age: getCacheAge(cache),
            accountsCount: Object.keys(cache.data.accounts).length,
          }
        : {
            exists: false,
          },
    });
  } catch (error) {
    console.error("[MONITORING BACKGROUND API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
        startMonitoringBackgroundJob();
        return NextResponse.json({
          success: true,
          message: "Background job started",
          status: getBackgroundJobStatus(),
        });

      case "stop":
        stopMonitoringBackgroundJob();
        return NextResponse.json({
          success: true,
          message: "Background job stopped",
          status: getBackgroundJobStatus(),
        });

      case "refresh":
        await refreshMonitoringCache();
        return NextResponse.json({
          success: true,
          message: "Cache refreshed",
          status: getBackgroundJobStatus(),
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use: start, stop, or refresh",
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[MONITORING BACKGROUND API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
