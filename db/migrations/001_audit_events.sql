CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL,
  actor_user_id varchar(512) NOT NULL,
  actor_email varchar(512) NOT NULL,
  actor_name varchar(512) NOT NULL,
  actor_role varchar(64) NOT NULL,
  action varchar(128) NOT NULL,
  method varchar(16) NOT NULL,
  route varchar(512) NOT NULL,
  result varchar(16) NOT NULL CHECK (result IN ('success', 'failure', 'denied', 'error', 'partial')),
  status_code integer NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  ip varchar(128) NOT NULL,
  user_agent varchar(512) NOT NULL,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit_events (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_idx ON audit_events (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_events_actor_email_idx ON audit_events (actor_email);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events (action);
CREATE INDEX IF NOT EXISTS audit_events_result_idx ON audit_events (result);
CREATE INDEX IF NOT EXISTS audit_events_route_idx ON audit_events (route);
CREATE INDEX IF NOT EXISTS audit_events_ip_idx ON audit_events (ip);
CREATE INDEX IF NOT EXISTS audit_events_request_id_idx ON audit_events (request_id);

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

DROP TRIGGER IF EXISTS audit_events_truncate_block ON audit_events;
CREATE TRIGGER audit_events_truncate_block
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_event_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC;
