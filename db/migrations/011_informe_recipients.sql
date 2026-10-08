-- 011: Destinatarios editables del informe diario (texto plano, sin cifrar).
-- Si la tabla tiene destinatarios activos, estos tienen prioridad sobre
-- la variable de entorno SENDGRID_RECIPIENTS (que queda como respaldo).

CREATE TABLE IF NOT EXISTS informe_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  name VARCHAR(200),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT informe_recipients_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_informe_recipients_active ON informe_recipients (active);

-- Semilla: conserva el destinatario que antes vivía cifrado en el .env
INSERT INTO informe_recipients (email, name, active, created_by)
VALUES ('dilan.bolano@ux.technology', 'Dilan Bolaño', true, 'migration:011')
ON CONFLICT (email) DO NOTHING;
