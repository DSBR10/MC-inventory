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

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  try {
    const result = await queryAudit(
      "SELECT id, name, position, created_at FROM server_columns ORDER BY position ASC"
    );
    await recordApiAudit(request, guard.session, {
      action: "data.server_columns.read",
      category: "data",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { returned: result.rows.length },
    });
    return NextResponse.json({ columns: result.rows });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_columns.read",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
    });
    return NextResponse.json({ error: "Failed to load columns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;
  const startedAt = Date.now();
  const context = getRequestContext(request);

  if (!hasAuditHashSecret()) {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column.create",
      category: "data",
      result: "error",
      statusCode: 503,
      startedAt,
      metadata: { code: "audit_hash_unavailable" },
    });
    return NextResponse.json({ error: "Audit service unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json() as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) {
      await recordApiAudit(request, guard.session, {
        action: "data.server_column.create",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_name" },
      });
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const column = await withTransaction(async (client) => {
      const maxPosition = await client.query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM server_columns"
      );
      const position = maxPosition.rows[0].next_pos;
      const inserted = await client.query(
        "INSERT INTO server_columns (name, position) VALUES ($1, $2) RETURNING id, name, position, created_at",
        [name, position]
      );
      const created = inserted.rows[0];
      await recordAuditEventWithClient(client, {
        request,
        context,
        session: guard.session,
        action: "data.server_column.created",
        category: "data",
        result: "success",
        statusCode: 201,
        durationMs: Date.now() - startedAt,
        targetType: "server_column",
        targetId: created.id,
        operationId: context.requestId,
        metadata: { position, nameLength: name.length, nameHash: hashAuditValue(name) },
      });
      return created;
    });

    return NextResponse.json({ column }, { status: 201 });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column.create",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "create_failed" },
    });
    return NextResponse.json({ error: "Failed to create column" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;
  const startedAt = Date.now();
  const context = getRequestContext(request);

  if (!hasAuditHashSecret()) {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column.rename",
      category: "data",
      result: "error",
      statusCode: 503,
      startedAt,
      metadata: { code: "audit_hash_unavailable" },
    });
    return NextResponse.json({ error: "Audit service unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json() as { id?: unknown; name?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!isValidAuditUuid(id) || !name || name.length > 100) {
      await recordApiAudit(request, guard.session, {
        action: "data.server_column.rename",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_payload" },
      });
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    const column = await withTransaction(async (client) => {
      const updated = await client.query(
        "UPDATE server_columns SET name = $1 WHERE id = $2::uuid RETURNING id, name, position, created_at",
        [name, id]
      );
      if (updated.rows.length === 0) {
        await recordAuditEventWithClient(client, {
          request,
          context,
          session: guard.session,
          action: "data.server_column.rename",
          category: "data",
          result: "failure",
          statusCode: 404,
          durationMs: Date.now() - startedAt,
          targetType: "server_column",
          targetId: id,
          operationId: context.requestId,
          metadata: { code: "not_found" },
        });
        return null;
      }
      const renamed = updated.rows[0];
      await recordAuditEventWithClient(client, {
        request,
        context,
        session: guard.session,
        action: "data.server_column.renamed",
        category: "data",
        result: "success",
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        targetType: "server_column",
        targetId: id,
        operationId: context.requestId,
        metadata: { nameLength: name.length, nameHash: hashAuditValue(name) },
      });
      return renamed;
    });

    if (!column) return NextResponse.json({ error: "Column not found" }, { status: 404 });
    return NextResponse.json({ column });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column.rename",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "rename_failed" },
    });
    return NextResponse.json({ error: "Failed to update column" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiSession("inventory:modify", request);
  if (guard.response) return guard.response;
  const startedAt = Date.now();
  const context = getRequestContext(request);

  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!isValidAuditUuid(id)) {
      await recordApiAudit(request, guard.session, {
        action: "data.server_column.delete",
        category: "data",
        result: "failure",
        statusCode: 400,
        startedAt,
        metadata: { code: "invalid_id" },
      });
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const deleted = await withTransaction(async (client) => {
      const values = await client.query(
        "SELECT COUNT(*)::integer AS count FROM server_column_values WHERE column_id = $1::uuid",
        [id]
      );
      const result = await client.query(
        "DELETE FROM server_columns WHERE id = $1::uuid RETURNING id",
        [id]
      );
      const removed = result.rows[0] || null;
      await recordAuditEventWithClient(client, {
        request,
        context,
        session: guard.session,
        action: removed ? "data.server_column.deleted" : "data.server_column.delete",
        category: "data",
        result: removed ? "success" : "failure",
        statusCode: removed ? 200 : 404,
        durationMs: Date.now() - startedAt,
        targetType: "server_column",
        targetId: id,
        operationId: context.requestId,
        metadata: removed
          ? { deletedValueCount: values.rows[0]?.count || 0 }
          : { code: "not_found" },
      });
      return removed;
    });

    if (!deleted) return NextResponse.json({ error: "Column not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    await recordApiAudit(request, guard.session, {
      action: "data.server_column.delete",
      category: "data",
      result: "error",
      statusCode: 500,
      startedAt,
      metadata: { code: "delete_failed" },
    });
    return NextResponse.json({ error: "Failed to delete column" }, { status: 500 });
  }
}
