-- 012: Servidores con backup de logs esperado (comparativa diaria).
-- El roster es la UNION de esta tabla manual + los servidores ya vistos
-- históricamente en log_backups. Así un servidor conocido al que ayer no
-- se le generó carpeta se marca en rojo como SIN BACKUP.

CREATE TABLE IF NOT EXISTS log_expected_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(32) NOT NULL CHECK (provider IN ('AWS', 'HUAWEI CLOUD')),
  account_id varchar(128) NOT NULL,
  account_name varchar(256) NOT NULL DEFAULT 'N/A',
  server_name varchar(512) NOT NULL,
  bucket_name varchar(256) NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by varchar(512),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT log_expected_servers_unique UNIQUE (provider, account_id, server_name)
);

CREATE INDEX IF NOT EXISTS log_expected_servers_account_idx
  ON log_expected_servers (provider, account_id, active);
