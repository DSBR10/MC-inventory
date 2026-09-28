import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sslMode = (process.env.DATABASE_SSL || "require").trim().toLowerCase();
const ssl = sslMode === "disable"
  ? false
  : {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      ...(process.env.DATABASE_SSL_CA_FILE
        ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE.trim()) }
        : {}),
    };
const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 10_000,
  ssl,
});

const actor = `migration:${hostname()}:${process.pid}`;

async function auditMigration(client, file, checksum, durationMs, result, statusCode) {
  const hasTelemetry = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_events' AND column_name = 'category'
     ) AS enabled`
  );
  if (!hasTelemetry.rows[0]?.enabled) return;

  const common = [
    randomUUID(),
    new Date().toISOString(),
    new Date().toISOString(),
    randomUUID(),
    "system:migrations",
    "system",
    "Database Migrations",
    "system",
    "system",
    result === "success" ? "admin.migration.applied" : "admin.migration.failed",
    "system",
    "cli",
    "authoritative",
    "migration",
    file,
    "CLI",
    `/db/migrations/${file}`,
    result,
    statusCode,
    "system",
    "migration-runner",
    durationMs,
    JSON.stringify({ checksum, durationMs, result }),
  ];

  if (hasTelemetry.rows[0].enabled) {
    await client.query(
      `INSERT INTO audit_events
        (id, occurred_at, recorded_at, request_id, actor_user_id, actor_email,
         actor_name, actor_role, actor_type, action, category, source, confidence,
         target_type, target_id, method, route, result, status_code, ip, user_agent,
         duration_ms, metadata)
       VALUES ($1::uuid, $2::timestamptz, $3::timestamptz, $4::uuid, $5, $6,
               $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
               $20, $21, $22, $23::jsonb)`,
      common,
    );
  }
}

let client;
try {
  client = await pool.connect();
  await client.query("SELECT pg_advisory_lock(hashtext('mc-inventory-schema-migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum varchar(64)`);
  await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS duration_ms integer`);
  await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS applied_by varchar(128)`);

  const directory = join(process.cwd(), "db", "migrations");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (applied.rowCount) continue;

    const sql = await readFile(join(directory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const startedAt = Date.now();
    await client.query("BEGIN");
    try {
      await client.query(sql);
      const durationMs = Date.now() - startedAt;
      await client.query(
        `INSERT INTO schema_migrations (name, checksum, duration_ms, applied_by)
         VALUES ($1, $2, $3, $4)`,
        [file, checksum, durationMs, actor]
      );
      await client.query("COMMIT");
      await auditMigration(client, file, checksum, durationMs, "success", 200);
      console.info(`Applied migration ${file}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      await auditMigration(client, file, checksum, Date.now() - startedAt, "error", 500).catch(() => undefined);
      throw error;
    }
  }
} catch {
  console.error("Database migration failed");
  process.exitCode = 1;
} finally {
  if (client) {
    await client.query("SELECT pg_advisory_unlock(hashtext('mc-inventory-schema-migrations'))").catch(() => undefined);
    client.release();
  }
  await pool.end();
}
