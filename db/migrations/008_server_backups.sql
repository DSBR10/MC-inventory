-- 008: Bitácora de backups de servidores (AWS Backup + Huawei CBR)
-- Se refresca a diario vía scheduler (06:00 America/Bogota por defecto).

CREATE TABLE IF NOT EXISTS server_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(32) NOT NULL CHECK (provider IN ('AWS', 'HUAWEI CLOUD')),
  account_id varchar(128) NOT NULL,
  account_name varchar(256) NOT NULL DEFAULT 'N/A',
  region varchar(64) NOT NULL DEFAULT '',
  vault_id varchar(512) NOT NULL DEFAULT '',
  vault_name varchar(512) NOT NULL DEFAULT '',
  backup_id varchar(1024) NOT NULL,
  backup_name varchar(1024) NOT NULL DEFAULT '',
  resource_id varchar(1024) NOT NULL DEFAULT '',
  resource_name varchar(1024) NOT NULL DEFAULT '',
  resource_type varchar(128) NOT NULL DEFAULT '',
  status varchar(64) NOT NULL DEFAULT 'UNKNOWN',
  size_bytes bigint,
  backup_created_at timestamptz,
  backup_completed_at timestamptz,
  backup_expires_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_backups_raw_object CHECK (jsonb_typeof(raw) = 'object'),
  CONSTRAINT server_backups_unique_backup UNIQUE (provider, account_id, backup_id)
);

CREATE INDEX IF NOT EXISTS server_backups_provider_idx ON server_backups (provider);
CREATE INDEX IF NOT EXISTS server_backups_account_idx ON server_backups (provider, account_id, account_name);
CREATE INDEX IF NOT EXISTS server_backups_created_idx ON server_backups (backup_created_at DESC);
CREATE INDEX IF NOT EXISTS server_backups_status_idx ON server_backups (status);
CREATE INDEX IF NOT EXISTS server_backups_resource_idx ON server_backups (resource_id, resource_name);
CREATE INDEX IF NOT EXISTS server_backups_search_idx ON server_backups
  USING gin (to_tsvector('simple', coalesce(backup_name, '') || ' ' || coalesce(resource_name, '') || ' ' || coalesce(backup_id, '') || ' ' || coalesce(vault_name, '')));

-- Log de cada ejecución del refresco (manual o programado).
CREATE TABLE IF NOT EXISTS backup_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger varchar(16) NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  triggered_by varchar(512),
  status varchar(16) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'error')),
  records_upserted integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT backup_refresh_log_details_object CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX IF NOT EXISTS backup_refresh_log_started_idx ON backup_refresh_log (started_at DESC);
