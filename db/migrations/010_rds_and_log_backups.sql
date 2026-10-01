-- 010: Backups de RDS y logs transaccionales

-- Backups de base de datos (RDS snapshots AWS + Huawei RDS backups)
CREATE TABLE IF NOT EXISTS rds_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(32) NOT NULL CHECK (provider IN ('AWS', 'HUAWEI CLOUD')),
  account_id varchar(128) NOT NULL,
  account_name varchar(256) NOT NULL DEFAULT 'N/A',
  region varchar(64) NOT NULL DEFAULT '',
  db_instance_id varchar(256) NOT NULL DEFAULT '',
  db_instance_name varchar(256) NOT NULL DEFAULT '',
  engine varchar(64) NOT NULL DEFAULT '',
  snapshot_id varchar(1024) NOT NULL,
  snapshot_name varchar(1024) NOT NULL DEFAULT '',
  snapshot_type varchar(64) NOT NULL DEFAULT '',
  status varchar(64) NOT NULL DEFAULT 'UNKNOWN',
  size_bytes bigint,
  snapshot_created_at timestamptz,
  snapshot_completed_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rds_backups_unique_snapshot UNIQUE (provider, account_id, snapshot_id)
);

CREATE INDEX IF NOT EXISTS rds_backups_provider_idx ON rds_backups (provider);
CREATE INDEX IF NOT EXISTS rds_backups_account_idx ON rds_backups (provider, account_id, account_name);
CREATE INDEX IF NOT EXISTS rds_backups_created_idx ON rds_backups (snapshot_created_at DESC);
CREATE INDEX IF NOT EXISTS rds_backups_status_idx ON rds_backups (status);
CREATE INDEX IF NOT EXISTS rds_backups_instance_idx ON rds_backups (db_instance_id, db_instance_name);
CREATE INDEX IF NOT EXISTS rds_backups_search_idx ON rds_backups
  USING gin (to_tsvector('simple', coalesce(snapshot_name, '') || ' ' || coalesce(db_instance_name, '') || ' ' || coalesce(snapshot_id, '') || ' ' || coalesce(db_instance_id, '')));

-- Backups de logs transaccionales (S3 para AWS Siga, OBS para Huawei)
CREATE TABLE IF NOT EXISTS log_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(32) NOT NULL CHECK (provider IN ('AWS', 'HUAWEI CLOUD')),
  account_id varchar(128) NOT NULL,
  account_name varchar(256) NOT NULL DEFAULT 'N/A',
  region varchar(64) NOT NULL DEFAULT '',
  bucket_name varchar(256) NOT NULL DEFAULT '',
  backup_date varchar(8) NOT NULL,
  server_name varchar(512) NOT NULL DEFAULT '',
  folder_exists boolean NOT NULL DEFAULT false,
  size_bytes bigint NOT NULL DEFAULT 0,
  status varchar(64) NOT NULL DEFAULT 'UNKNOWN',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT log_backups_unique_entry UNIQUE (provider, account_id, bucket_name, backup_date, server_name)
);

CREATE INDEX IF NOT EXISTS log_backups_provider_idx ON log_backups (provider);
CREATE INDEX IF NOT EXISTS log_backups_account_idx ON log_backups (provider, account_id, account_name);
CREATE INDEX IF NOT EXISTS log_backups_date_idx ON log_backups (backup_date DESC);
CREATE INDEX IF NOT EXISTS log_backups_status_idx ON log_backups (status);
CREATE INDEX IF NOT EXISTS log_backups_server_idx ON log_backups (server_name);
CREATE INDEX IF NOT EXISTS log_backups_search_idx ON log_backups
  USING gin (to_tsvector('simple', coalesce(server_name, '') || ' ' || coalesce(bucket_name, '') || ' ' || coalesce(account_name, '')));
