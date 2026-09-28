import { NextRequest, NextResponse } from "next/server";

import {
  getRequestContext,
  hasAuditHashSecret,
  hashAuditValue,
  isValidAuditUuid,
  recordApiAudit,
  recordAuditEventWithClient,
} from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { queryAudit, withTransaction } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

const safeServerId = /^[A-Za-z0-9_.:/-]{1,255}$/;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  try {
    const result = await queryAudit(
      "SELECT id, column_id, server_id, value, created_at, updated_at FROM server_column_values ORDER BY updated_at DESC"
    );
    await recordApiAudit(request, guard.session, {
      action: "data.server_column_values.read",
      category: "data",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { returned: result.rows.length },
    });
    return NextResponse.json({ values: result.rows });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column_values.read",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
    });
    return NextResponse.json({ error: "Failed to load values" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;
  const startedAt = Date.now();
  const context = getRequestContext(request);

  if (!hasAuditHashSecret()) {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column_value.upsert",
      category: "data",
      result: "error",
      statusCode: 503,
      startedAt,
      metadata: { code: "audit_hash_unavailable" },
    });
    return NextResponse.json({ error: "Audit service unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json() as { columnId?: unknown; serverId?: unknown; value?: unknown };
    const columnId = typeof body.columnId === "string" ? body.columnId : "";
    const serverId = typeof body.serverId === "string" ? body.serverId.trim() : "";
    const value = typeof body.value === "string" ? body.value : "";
    if (!isValidAuditUuid(columnId) || !safeServerId.test(serverId) || value.length > 10_000) {
      await recordApiAudit(request, guard.session, {
        action: "data.server_column_value.upsert",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_payload" },
      });
      return NextResponse.json({ error: "columnId, serverId and value are required" }, { status: 400 });
    }

    const saved = await withTransaction(async (client) => {
      const previous = await client.query(
        "SELECT value FROM server_column_values WHERE column_id = $1::uuid AND server_id = $2",
        [columnId, serverId]
      );
      const result = await client.query(
        `INSERT INTO server_column_values (column_id, server_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (column_id, server_id)
         DO UPDATE SET value = $3, updated_at = NOW()
         RETURNING id, column_id, server_id, value, created_at, updated_at`,
        [columnId, serverId, value]
      );
      const savedValue = result.rows[0];
      const previousValue = previous.rows[0]?.value;
      await recordAuditEventWithClient(client, {
        request,
        context,
        session: guard.session,
        action: "data.server_column_value.upserted",
        category: "data",
        result: "success",
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        targetType: "server_column_value",
        targetId: serverId,
        operationId: context.requestId,
        metadata: {
          columnId,
          valueLength: value.length,
          valueHash: hashAuditValue(value),
          previousValueHash: previousValue === undefined ? null : hashAuditValue(previousValue),
          changed: previousValue !== value,
        },
      });
      return savedValue;
    });

    return NextResponse.json({ value: saved });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column_value.upsert",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "upsert_failed" },
    });
    return NextResponse.json({ error: "Failed to save value" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;
  const startedAt = Date.now();
  const context = getRequestContext(request);

  if (!hasAuditHashSecret()) {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column_value.delete",
      category: "data",
      result: "error",
      statusCode: 503,
      startedAt,
      metadata: { code: "audit_hash_unavailable" },
    });
    return NextResponse.json({ error: "Audit service unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json() as { columnId?: unknown; serverId?: unknown };
    const columnId = typeof body.columnId === "string" ? body.columnId : "";
    const serverId = typeof body.serverId === "string" ? body.serverId.trim() : "";
    if (!isValidAuditUuid(columnId) || !safeServerId.test(serverId)) {
      await recordApiAudit(request, guard.session, {
        action: "data.server_column_value.delete",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_payload" },
      });
      return NextResponse.json({ error: "columnId and serverId are required" }, { status: 400 });
    }

    await withTransaction(async (client) => {
      const deleted = await client.query(
        "DELETE FROM server_column_values WHERE column_id = $1::uuid AND server_id = $2 RETURNING value",
        [columnId, serverId]
      );
      const previousValue = deleted.rows[0]?.value;
      await recordAuditEventWithClient(client, {
        request,
        context,
        session: guard.session,
        action: "data.server_column_value.deleted",
        category: "data",
        result: "success",
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        targetType: "server_column_value",
        targetId: serverId,
        operationId: context.requestId,
        metadata: {
          columnId,
          found: !!deleted.rows[0],
          previousValueHash: previousValue === undefined ? null : hashAuditValue(previousValue),
          previousValueLength: previousValue?.length || 0,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column_value.delete",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "delete_failed" },
    });
    return NextResponse.json({ error: "Failed to delete value" }, { status: 500 });
  }
}
