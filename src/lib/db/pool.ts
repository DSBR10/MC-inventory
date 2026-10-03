import { readFileSync } from "node:fs";

import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";

import { resolveSecret } from "@/lib/secrets/crypto";

const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_QUERY_TIMEOUT_MS = 10_000;

declare global {
  var __mcInventoryAuditPool: Pool | undefined;
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function createPool() {
  // DATABASE_URL puede venir cifrado como ENC:v1:... (AES-256-GCM).
  const connectionString = resolveSecret(process.env.DATABASE_URL?.trim());
  if (!connectionString) {
    throw new Error("AUDIT_DATABASE_NOT_CONFIGURED");
  }

  const sslMode = (process.env.DATABASE_SSL || "require").trim().toLowerCase();
  const config: PoolConfig = {
    connectionString,
    max: positiveInteger(process.env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX, 50),
    idleTimeoutMillis: positiveInteger(
      process.env.DATABASE_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS,
      300_000,
    ),
    connectionTimeoutMillis: positiveInteger(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS,
      30_000,
    ),
    query_timeout: positiveInteger(
      process.env.DATABASE_QUERY_TIMEOUT_MS,
      DEFAULT_QUERY_TIMEOUT_MS,
      60_000,
    ),
    application_name: "mc-inventory-audit",
  };

  if (sslMode === "disable") {
    config.ssl = false;
  } else {
    config.ssl = {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
    };
    const caPath = process.env.DATABASE_SSL_CA_FILE?.trim();
    if (caPath) config.ssl.ca = readFileSync(caPath);
  }

  const pool = new Pool(config);
  // Log pool-level errors (idle client errors, backend crashes, etc.)
  // Avoid leaking connection details in the message.
  pool.on("error", (err) => {
    console.error("[db] pool error:", err.message || "unknown");
  });
  return pool;
}

export function getAuditPool() {
  if (!globalThis.__mcInventoryAuditPool) {
    globalThis.__mcInventoryAuditPool = createPool();
  }

  return globalThis.__mcInventoryAuditPool;
}

export async function queryAudit<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  try {
    return await getAuditPool().query<T>(text, [...values]);
  } catch (err: any) {
    const message = err?.message || "unknown";
    console.error("[db] query failed:", message);
    const error = new Error(`AUDIT_DATABASE_UNAVAILABLE: ${message}`);
    error.cause = err;
    throw error;
  }
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await getAuditPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
