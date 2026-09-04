import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import {
  startMonitoringBackgroundJob,
  stopMonitoringBackgroundJob,
  getBackgroundJobStatus,
  refreshMonitoringCache,
} from "@/lib/monitoring/background";
import { readMonitoringCache, getCacheAge } from "@/lib/monitoring/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("monitoring:view", request);
    if (guard.response) return guard.response;

    const cache = readMonitoringCache();
    const status = getBackgroundJobStatus();

    await recordApiAudit(request, guard.session, {
      action: "monitoring.background.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { cacheExists: Boolean(cache) },
    });
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
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.background.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo consultar el estado del monitoreo",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("settings:modify", request);
    if (guard.response) return guard.response;

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
        startMonitoringBackgroundJob();
        await recordApiAudit(request, guard.session, {
          action: "monitoring.background.start",
          result: "success",
          statusCode: 200,
          startedAt,
        });
        return NextResponse.json({
          success: true,
          message: "Background job started",
          status: getBackgroundJobStatus(),
        });

      case "stop":
        stopMonitoringBackgroundJob();
        await recordApiAudit(request, guard.session, {
          action: "monitoring.background.stop",
          result: "success",
          statusCode: 200,
          startedAt,
        });
        return NextResponse.json({
          success: true,
          message: "Background job stopped",
          status: getBackgroundJobStatus(),
        });

      case "refresh":
        await refreshMonitoringCache();
        await recordApiAudit(request, guard.session, {
          action: "monitoring.background.refresh",
          result: "success",
          statusCode: 200,
          startedAt,
        });
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
  } catch {
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "monitoring.background.update",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo actualizar el monitoreo",
      },
      { status: 500 },
    );
  }
}
