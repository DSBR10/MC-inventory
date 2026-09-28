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
import { withTransaction } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type ReorderColumn = { id: string; position: number };

export async function PUT(request: NextRequest) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;
  const startedAt = Date.now();
  const context = getRequestContext(request);

  if (!hasAuditHashSecret()) {
    await recordApiAudit(request, guard.session, {
      action: "data.server_columns.reorder",
      category: "data",
      result: "error",
      statusCode: 503,
      startedAt,
      metadata: { code: "audit_hash_unavailable" },
    });
    return NextResponse.json({ error: "Audit service unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json() as { columns?: unknown };
    const columns = Array.isArray(body.columns) ? body.columns as ReorderColumn[] : [];
    const valid = columns.length > 0
      && columns.length <= 100
      && columns.every((column) => (
        column
        && isValidAuditUuid(column.id)
        && Number.isInteger(column.position)
        && column.position >= 0
        && column.position < 100
      ))
      && new Set(columns.map((column) => column.id)).size === columns.length;

    if (!valid) {
      await recordApiAudit(request, guard.session, {
        action: "data.server_columns.reorder",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_payload" },
      });
      return NextResponse.json({ error: "A valid columns array is required" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      for (const column of columns) {
        await client.query(
          "UPDATE server_columns SET position = $1 WHERE id = $2::uuid",
          [column.position, column.id]
        );
      }
      const reordered = await client.query(
        "SELECT id, name, position, created_at FROM server_columns ORDER BY position ASC"
      );
      await recordAuditEventWithClient(client, {
        request,
        context,
        session: guard.session,
        action: "data.server_columns.reordered",
        category: "data",
        result: "success",
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        targetType: "server_columns",
        operationId: context.requestId,
        metadata: {
          submittedCount: columns.length,
          storedCount: reordered.rows.length,
          orderHash: hashAuditValue(columns.map((column) => `${column.id}:${column.position}`).join("|")),
        },
      });
      return reordered.rows;
    });

    return NextResponse.json({ columns: result });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_columns.reorder",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "reorder_failed" },
    });
    return NextResponse.json({ error: "Failed to reorder columns" }, { status: 500 });
  }
}
