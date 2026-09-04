# MC Inventory

MC Inventory is a SaaS platform designed to centralize and automate cloud infrastructure inventory management in hybrid and multicloud environments (AWS & Huawei Cloud).

## 🚀 Features

### Inventory Management

- Real-time AWS & Huawei Cloud inventory sync
- EC2 / ECS instance detection
- RDS / DocumentDB database detection
- ECS / CCE cluster detection
- CloudFront / CDN distribution detection
- Lambda functions inventory
- S3 / OBS buckets inventory
- DynamoDB / DDS tables inventory
- ElastiCache / DCS cache clusters
- API Gateway inventory
- Automatic refresh with caching
- Modern dashboard UI
- Status visualization (Running / Stopped)

### Monitoring & Logs

- Real-time log aggregation from CloudWatch (AWS) and LTS (Huawei)
- Advanced log filtering (by provider, account, severity, time range)
- Metrics dashboard (total logs, errors, warnings, info)
- Log search functionality
- Multi-account and multi-region support

### Billing & Cost Management

- AWS Cost Explorer integration
- Huawei Cloud billing integration
- Monthly cost breakdown by service
- Cost trends and forecasting
- Multi-account cost aggregation

## 🛠 Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, TailwindCSS
- **Backend:** Next.js API Routes, Server-side rendering
- **Cloud SDKs:** AWS SDK v3, Huawei Cloud SDK
- **Authentication:** NextAuth.js
- **Caching:** File-based caching system
- **Charts:** Recharts

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm
- AWS Account(s) with appropriate IAM permissions
- Huawei Cloud Account(s) with AK/SK credentials
- Environment variables configured (see `.env.example`)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd mc-inventory
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

**Required variables:**

#### AWS Accounts

```env
AWS_ACCOUNT_1_NAME=MC Inventory
AWS_ACCOUNT_1_ACCESS_KEY_ID=your_aws_access_key
AWS_ACCOUNT_1_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_ACCOUNT_1_REGION=us-east-1
```

#### Huawei Cloud Accounts

```env
HUAWEI_ACCOUNT_1_NAME=mc_inventory
HUAWEI_ACCOUNT_1_PROJECT_ID=your_project_id
HUAWEI_ACCOUNT_1_AK=your_access_key
HUAWEI_ACCOUNT_1_SK=your_secret_key
HUAWEI_ACCOUNT_1_REGION=la-north-2
```

**Note:** You can add multiple accounts by incrementing the index (1, 2, 3, etc.)

#### NextAuth Configuration

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
ALLOWED_USERS=user1@example.com,user2@example.com
```

### 4. Persistent audit database

The audit module uses PostgreSQL through `pg` and does not use an ORM. Set `DATABASE_URL`, `NEXTAUTH_SECRET` and a separate `AUDIT_HASH_SECRET` with at least 32 random characters. The application never logs `DATABASE_URL`; audit metadata is recursively filtered and the `audit_events` table rejects updates and deletes.

Run the idempotent migration before starting the application:

```bash
npm run db:migrate
```

The migration requires `DATABASE_URL`. In Docker, the application entrypoint waits for the healthy `postgres` service and runs the migration automatically. PostgreSQL is only reachable on the private Compose network by default:

```bash
docker compose up --build
```

The Compose file requires `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` and `AUDIT_HASH_SECRET` from the shell or an external Compose environment file. It intentionally does not copy `.env.local`. The default Docker network uses an explicit local-only non-TLS PostgreSQL connection because the stock `postgres:16-alpine` service is not provisioned with certificates; use a managed PostgreSQL/private TLS endpoint and `DATABASE_SSL=require` with certificate verification for production. Never set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` in production.

For a production image, the multi-stage `Dockerfile` builds Next standalone output, includes only the migration runner and migration files, and starts the application only after a successful migration. A failed migration prevents the application from starting.

### 5. Run the development server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚢 Despliegue productivo (Amazon Linux + Docker)

Guía para un servidor **Amazon Linux 2023** con Docker, con el proyecto en la ruta fija:

```
/libre/devops/apps/MC-Inventory/
```

Arquitectura con este repo:

- `app`: imagen multi-stage (`Dockerfile`) con Next.js 16 en modo `standalone`. El `docker-entrypoint.sh` ejecuta `node /app/scripts/migrate.mjs` y **solo arranca si la migración es exitosa**.
- `postgres`: `postgres:16-alpine` con volumen `postgres_data` y `healthcheck` (`pg_isready`). `app` espera a `postgres` con `depends_on: service_healthy`.
- Red privada de Compose. Postgres **no expone puertos al host** por defecto. `DATABASE_URL` se construye dentro del Compose como `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`.
- Healthcheck HTTP simple: `GET /api/health` → `{"status":"ok"}` (no verifica BD).

### 1. Requisitos del servidor

- Amazon Linux 2023 (x86_64 o ARM, la imagen `node:20-alpine` y `postgres:16-alpine` son multi-arch).
- Docker Engine + plugin Compose v2, Git, `openssl` (para generar secretos).
- DNS apuntando al servidor (ej. `inventario.tudominio.com`) y certificado TLS (recomendado: ALB + ACM; alternativo: Nginx + certbot en el host).
- Security Group: abrir `80/443` al mundo, **no abrir `3000` ni `5432`** salvo administración temporal desde IP fija.
- Disco: mínimo 20 GB libres (imágenes + `postgres_data` + logs). Vigilar `/var/lib/docker`.

Instalación en Amazon Linux 2023:

```bash
sudo dnf update -y
sudo dnf install -y docker git openssl
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Re-conectarse por SSH para que aplique el grupo docker
docker --version
docker compose version
```

### 2. Ruta del proyecto y permisos

```bash
sudo mkdir -p /libre/devops/apps/MC-Inventory
sudo chown -R $USER:$USER /libre/devops/apps/MC-Inventory
cd /libre/devops/apps/MC-Inventory

# Opción A: clonar
git clone <repository-url> .
# Opción B: copiar desde tu PC (ej. scp/rsync) y luego:
# rsync -avz ./ usuario@servidor:/libre/devops/apps/MC-Inventory/
```

El directorio debe contener `docker-compose.yml`, `Dockerfile`, `docker-entrypoint.sh`, `db/migrations/`, `scripts/migrate.mjs`, `src/`.

### 3. Variables de entorno de producción (`.env`)

Compose **requiere** un archivo `.env` junto al `docker-compose.yml` (no usa `.env.local`). Mínimo obligatorio:

| Variable | Producción |
|---|---|
| `APP_PORT` | `3000` (interno; no exponer directo, ir detrás de ALB/Nginx) |
| `POSTGRES_DB` / `POSTGRES_USER` | ej. `mc_inventory` / `mc_inventory` |
| `POSTGRES_PASSWORD` | ≥ 24 caracteres aleatorios, sin `:` `/` `@` `#` (rompen la `DATABASE_URL` construida) |
| `NEXTAUTH_URL` | URL pública **https**, ej. `https://inventario.tudominio.com` (si es incorrecta falla el login) |
| `NEXTAUTH_SECRET` | ≥ 32 caracteres aleatorios |
| `AUDIT_HASH_SECRET` | ≥ 32 caracteres aleatorios, distinto del anterior |
| `DATABASE_SSL` | `disable` si usas el `postgres` del Compose (no tiene certificados). `require` solo con RDS/postgres con TLS |
| Resto (AWS/Huawei/Auth) | copiar los bloques que uses desde `.env.example` |

Generar secretos en el servidor (no reutilizar los de desarrollo):

```bash
cd /libre/devops/apps/MC-Inventory
openssl rand -base64 32  # POSTGRES_PASSWORD (quitar :/@# si aparecen)
openssl rand -base64 48  # NEXTAUTH_SECRET
openssl rand -base64 48  # AUDIT_HASH_SECRET
```

Crear `.env` a partir de `.env.example`:

```bash
cp .env.example .env
chmod 600 .env
# Editar .env: NEXTAUTH_URL=https, passwords/secretos generados,
# ALLOWED_USERS, ADMIN_EMAILS, LOCAL_ADMIN_*, AZURE_*, AWS_*, HUAWEI_*
```

Notas importantes:

- El servicio `app` además carga todo el `.env` vía `env_file`, por eso las cuentas `AWS_ACCOUNT_*` / `HUAWEI_ACCOUNT_*` van en el mismo `.env`.
- Si la instancia EC2 tiene **IAM Role**, preferirlo para la cuenta propia y reservar AK/SK en `.env` solo para cuentas externas. Las keys del `getAWSAccounts()` aceptan `AWS_ACCOUNT_X_ACCESS_KEY` o `AWS_ACCOUNT_X_ACCESS_KEY_ID` (y `SECRET_KEY` o `SECRET_ACCESS_KEY`).
- **Nunca** pongas `DATABASE_SSL_REJECT_UNAUTHORIZED=false` en producción.
- `.env*` está en `.gitignore`: no se commitea. El backup del `.env` va al gestor de secretos (AWS Secrets Manager / SSM Parameter Store), no a Git.
- Si migras a **RDS** más adelante: usa endpoint con TLS, `DATABASE_SSL=require`, y sobreescribe `DATABASE_URL` (el Compose actual la construye contra el servicio `postgres`; necesitarás un `docker-compose.override.yml` o variable externa y retirar/ignorar el servicio `postgres`).

### 4. Arranque

```bash
cd /libre/devops/apps/MC-Inventory
docker compose config   # valida que no falte ninguna variable :? requerida
docker compose up --build -d
docker compose ps
docker logs -f mc-inventory-app-1        # debe mostrar: Applied migration 001_audit_events.sql + Ready
docker logs -f mc-inventory-postgres-1
curl -s http://127.0.0.1:3000/api/health  # {"status":"ok"}
```

Verificar BD y migración:

```bash
docker exec -it mc-inventory-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
docker exec -it mc-inventory-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'SELECT name, applied_at FROM schema_migrations;'
# Esperado: audit_events + schema_migrations con 001_audit_events.sql
```

Si el log de `app` muestra `Database migration failed`, el contenedor no arranca (por diseño). Revisa credenciales `POSTGRES_*`, conectividad al servicio `postgres` y `DATABASE_SSL`.

### 5. Exposición HTTPS (no exponer Node directo)

Recomendado: **ALB + ACM** delante del host, target group al puerto `3000`, `NEXTAUTH_URL=https://...`. Alternativa con Nginx en el mismo host:

```nginx
server {
  listen 80;
  server_name inventario.tudominio.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl;
  server_name inventario.tudominio.com;
  # ssl_certificate / ssl_certificate_key (certbot/ACM)
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Tras cambiar `NEXTAUTH_URL`, recrear: `docker compose up -d`.

### 6. Operación diaria (sin tocar la BD)

La BD vive en el volumen persistente `postgres_data` (`/var/lib/postgresql/data` dentro del contenedor).
`docker compose down` **conserva** el volumen y sus registros; solo `docker compose down -v` lo **borra**.
Aun así, el flujo de despliegue recomendado **ni siquiera detiene postgres**: solo se reconstruye el servicio `app`.

```bash
cd /libre/devops/apps/MC-Inventory
docker compose ps
docker compose logs --tail 200 app
docker compose restart app      # solo app, la BD sigue corriendo

# Verificar persistencia del volumen (debe existir aunque los contenedores estén abajo):
docker volume ls | grep postgres_data
docker volume inspect <proyecto>_postgres_data
```

Actualización de versión (solo app, la BD no se detiene ni pierde registros):

```bash
cd /libre/devops/apps/MC-Inventory
git pull
docker compose up --build -d app
docker logs -f mc-inventory-app-1   # esperar "Ready"; la migración corre sola en el entrypoint
# Rollback: git checkout <tag-anterior> && docker compose up --build -d app
```

> Si algún día necesitas detener todo: `docker compose down` (conserva `postgres_data`).
> Nunca uses `docker compose down -v` en producción: eso sí borra la BD.

Backups de Postgres (volumen `postgres_data`):

```bash
# Dump lógico (recomendado, programar en cron diario)
docker exec mc-inventory-postgres-1 pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > /libre/devops/backups/mc-inventory-$(date +%F).dump
# Restaurar:
# cat backup.dump | docker exec -i mc-inventory-postgres-1 pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean
```

Retención sugerida: 7 diarios + 4 semanales, fuera del host (S3). Probar restore al menos una vez.

Ejemplo de cron diario (02:30) con limpieza de dumps de más de 7 días:

```bash
sudo mkdir -p /libre/devops/backups
crontab -e
# 30 2 * * * cd /libre/devops/apps/MC-Inventory && set -a && . ./.env && set +a && docker exec mc-inventory-postgres-1 pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > /libre/devops/backups/mc-inventory-$(date +\%F).dump && find /libre/devops/backups -name 'mc-inventory-*.dump' -mtime +7 -delete
```

Verificar un backup (contar eventos sin restaurar):

```bash
pg_restore --list /libre/devops/backups/mc-inventory-2026-01-01.dump | grep -c "TABLE DATA"
```

### 7. Endurecimiento y checklist pre-producción

- [ ] `.env` con `chmod 600`, propietario correcto, fuera de Git y respaldado en Secrets Manager/SSM.
- [ ] `NEXTAUTH_URL` https pública, `NEXTAUTH_SECRET` y `AUDIT_HASH_SECRET` fuertes y distintos.
- [ ] `POSTGRES_PASSWORD` fuerte, sin caracteres que rompan la URL.
- [ ] `DATABASE_SSL=disable` solo con postgres de Compose en red privada; `require` + CA si es RDS/TLS.
- [ ] Puertos `3000`/`5432` no publicados a internet (SG + sin `ports` extra en Compose).
- [ ] `restart: unless-stopped` activo (ya viene en el Compose) y Docker con `systemctl enable`.
- [ ] Reloj NTP y zona horaria del host correctos (auditoría usa `timestamptz`).
- [ ] Logs rotados (`/etc/docker/daemon.json` con `log-driver` + `max-size`, ej. `10m`/`3`).
- [ ] Espacio en disco monitorizado; `data/*.json` es caché local efímera, no respaldo.
- [ ] Rotación de secretos definida (ver sección 🔐 Security; `AUDIT_HASH_SECRET` solo en ventana de mantenimiento).
- [ ] Acceso SSH con key, sin password; usuarios mínimos.

### 8. Troubleshooting en Amazon Linux

| Síntoma | Causa probable / solución |
|---|---|
| `POSTGRES_* is required` al hacer `config/up` | Falta variable en `.env` o `.env` en otra ruta. Validar con `docker compose config` en `/libre/devops/apps/MC-Inventory` |
| `permission denied` con docker | Falta `usermod -aG docker`, re-login SSH, o usar `sudo` |
| `port 3000 already in use` | Otro proceso/contenedor. `ss -tlnp \| grep 3000`, cambiar `APP_PORT` o detener el otro servicio |
| App en loop / `migration failed` | Credenciales PG, `DATABASE_SSL` incorrecto para el destino, o migración SQL con error. Ver `docker logs app` |
| Login redirige a localhost | `NEXTAUTH_URL` sigue en `http://localhost:3000`. Poner la URL pública y recrear |
| `audit_events is append-only` | Normal: la tabla es solo-apéndice por trigger, no se puede UPDATE/DELETE/TRUNCATE |
| Disco lleno | `docker system df`, `docker image prune`, podar logs, ampliar EBS |
| `Conflict. The container name ... is already in use` | Contenedor huérfano de un despliegue anterior. Ver con `docker ps -a`, eliminar con `docker rm -f <nombre>` y repetir `docker compose up -d` |
| Tras `down`, ¿se pierden los registros? | No, si no usaste `-v`. Comprobar: `docker volume ls \| grep postgres_data` y `SELECT count(*) FROM audit_events;` |

## 📁 Project Structure

```
mc-inventory/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── inventory/    # Inventory API
│   │   │   ├── billing/      # Billing API
│   │   │   └── logs/         # Logs & Monitoring API
│   │   ├── billing/          # Billing page
│   │   ├── monitoreo/        # Monitoring page
│   │   └── page.tsx          # Home/Dashboard page
│   ├── components/            # React components
│   │   ├── monitoring/       # Monitoring components
│   │   └── ...               # Other components
│   ├── lib/                   # Library code
│   │   ├── aws/              # AWS SDK integrations
│   │   └── huawei/           # Huawei Cloud SDK integrations
│   └── types/                 # TypeScript type definitions
├── data/                      # Cache files (gitignored)
├── .env.local            # Environment variables (gitignored)
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## 🔐 Security

- AWS and Huawei Cloud credentials are managed locally using environment variables
- Never commit `.env.local` to version control
- Use IAM roles with least privilege principle
- Implement proper authentication with NextAuth.js
- Do not store commands, command output, passwords, tokens, cookies, authorization headers or cloud keys in audit records. SSM execution is disabled when `AUDIT_HASH_SECRET` is absent or weak, or when the pre-execution audit insert fails.
- Use `npm run db:migrate` for every schema change; migration names are tracked in `schema_migrations`.
- Rotate `NEXTAUTH_SECRET`, `AUDIT_HASH_SECRET`, PostgreSQL credentials and cloud credentials through the secret manager. For `AUDIT_HASH_SECRET`, deploy the new value during a maintenance window if continuity of command fingerprints is required, then revoke the old secret; old HMACs cannot be recomputed with the new key.
- Rotate PostgreSQL credentials by creating a new role/password, updating `DATABASE_URL` in the secret store, validating the migration and restarting the app, then revoking the old role/password. Do not put credentials in the image, Git or logs.
- Keep PostgreSQL off the host network unless temporary administrative access is explicitly required and protected by TLS and network controls.

## 🔧 IAM Permissions Required

### AWS IAM Permissions

Your AWS IAM user needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "ecs:Describe*",
        "ecs:List*",
        "lambda:List*",
        "lambda:GetFunction",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeTimeToLive",
        "elasticache:Describe*",
        "elasticache:ListTagsForResource",
        "apigateway:GET",
        "cloudfront:List*",
        "cloudfront:GetDistribution",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "ce:GetCostAndUsage"
      ],
      "Resource": "*"
    }
  ]
}
```

### Huawei Cloud Permissions

Your Huawei Cloud IAM user needs permissions for:

- ECS (Elastic Cloud Server)
- CCE (Cloud Container Engine)
- RDS (Relational Database Service)
- DDS (Document Database Service)
- OBS (Object Storage Service)
- LTS (Log Tank Service)
- BSS (Billing)

## 🐛 Troubleshooting

### Error: `lts.undefined.myhuaweicloud.com`

**Cause:** Missing `HUAWEI_ACCOUNT_X_REGION` in `.env.local`

**Solution:** Add the region to your Huawei account configuration:

```env
HUAWEI_ACCOUNT_1_REGION=la-north-2  # Mexico City, Mexico
```

Available Huawei Cloud regions:

- `la-north-2` - Mexico City, Mexico (Latin America)
- `la-south-2` - Santiago, Chile (Latin America)
- `ap-southeast-1` - Bangkok, Thailand
- `ap-southeast-2` - Singapore
- `ap-southeast-3` - Hong Kong
- `cn-north-1` - Beijing, China
- `cn-east-2` - Shanghai, China
- `cn-south-1` - Guangzhou, China

### Error: `ThrottlingException: Rate exceeded`

**Cause:** Too many API calls to AWS services

**Solution:** The application implements automatic retry with exponential backoff. If the error persists, increase the `CACHE_TTL` value in `.env.local`.

### Error: `InvalidParameterValue: Unrecognized engine name`

**Cause:** Trying to filter DocumentDB with invalid engine names

**Solution:** This has been fixed in the latest version. Make sure you're using the updated code.

### Error: `TypeError: tags is not iterable`

**Cause:** Some AWS services return tags as objects instead of arrays

**Solution:** This has been fixed in the latest version. The `formatAwsTags` function now handles both arrays and objects.

## 📝 License

MIT License

## 👥 Contributors

Developed by the MC Inventory team.
