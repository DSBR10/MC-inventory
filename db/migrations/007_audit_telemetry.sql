-- Expande el registro append-only para eventos de UI, navegación, actor
-- anónimo/sistema y correlación. Los eventos existentes quedan como
-- server/api/authoritative para conservar compatibilidad.

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category varchar(32) NOT NULL DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS actor_type varchar(16) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS confidence varchar(16) NOT NULL DEFAULT 'authoritative',
  ADD COLUMN IF NOT EXISTS auth_method varchar(32),
  ADD COLUMN IF NOT EXISTS target_type varchar(64),
  ADD COLUMN IF NOT EXISTS target_id varchar(512),
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS client_session_id uuid,
  ADD COLUMN IF NOT EXISTS navigation_id uuid,
  ADD COLUMN IF NOT EXISTS interaction_id uuid,
  ADD COLUMN IF NOT EXISTS parent_event_id uuid;

UPDATE audit_events
SET
  recorded_at = COALESCE(recorded_at, occurred_at),
  category = COALESCE(NULLIF(category, ''), 'api'),
  source = COALESCE(NULLIF(source, ''), 'server'),
  actor_type = COALESCE(NULLIF(actor_type, ''), 'user'),
  confidence = COALESCE(NULLIF(confidence, ''), 'authoritative')
WHERE recorded_at IS NULL
   OR category IS NULL
   OR source IS NULL
   OR actor_type IS NULL
   OR confidence IS NULL;

CREATE INDEX IF NOT EXISTS audit_events_category_time_idx
  ON audit_events (category, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_events_source_time_idx
  ON audit_events (source, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_time_idx
  ON audit_events (actor_user_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_events_operation_id_idx
  ON audit_events (operation_id)
  WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_client_session_idx
  ON audit_events (client_session_id, occurred_at DESC)
  WHERE client_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_navigation_id_idx
  ON audit_events (navigation_id, occurred_at DESC)
  WHERE navigation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_interaction_id_idx
  ON audit_events (interaction_id, occurred_at DESC)
  WHERE interaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_target_idx
  ON audit_events (target_type, target_id, occurred_at DESC)
  WHERE target_type IS NOT NULL;

ALTER TABLE schema_migrations
  ADD COLUMN IF NOT EXISTS checksum varchar(64),
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS applied_by varchar(128);
