# MC Inventory

Plataforma SaaS para centralizar y automatizar la gestion de inventario de infraestructura cloud en entornos hibridos y multicloud (AWS & Huawei Cloud).

---

## Tabla de contenidos

- [Caracteristicas](#-caracteristicas)
- [Tech Stack](#-tech-stack)
- [Arquitectura](#-arquitectura)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Prerrequisitos](#-prerrequisitos)
- [Inicio rapido (desarrollo local)](#-inicio-rapido-desarrollo-local)
- [Cifrado de secretos](#-cifrado-de-secretos)
- [Despliegue productivo en Amazon Linux 2023](#-despliegue-productivo-en-amazon-linux-2023)
  - [1. Requisitos del servidor](#1-requisitos-del-servidor)
  - [2. Ruta del proyecto y permisos](#2-ruta-del-proyecto-y-permisos)
  - [3. Variables de entorno de produccion](#3-variables-de-entorno-de-produccion)
  - [4. Arranque](#4-arranque)
  - [5. Exposicion HTTPS](#5-exposicion-https)
  - [6. Operacion diaria](#6-operacion-diaria)
  - [7. Backups](#7-backups)
  - [8. Endurecimiento y checklist pre-produccion](#8-endurecimiento-y-checklist-pre-produccion)
  - [9. Troubleshooting](#9-troubleshooting)
- [Seguridad](#-seguridad)
- [Permisos IAM requeridos](#-permisos-iam-requeridos)
- [Licencia](#-licencia)

---

## Caracteristicas

### Inventario multicloud

- Sincronizacion en tiempo real de inventario AWS & Huawei Cloud
- Deteccion de instancias EC2 / ECS
- Deteccion de bases de datos RDS / DocumentDB
- Deteccion de clusters ECS / CCE / EKS
- Deteccion de distribuciones CloudFront / CDN
- Inventario de funciones Lambda
- Inventario de buckets S3 / OBS
- Inventario de tablas DynamoDB / DDS
- Clusters ElastiCache / DCS
- API Gateway
- Refresco automatico con cacheo en disco (`data/*.json`, TTL configurable)
- Visualizacion de estado (Running / Stopped / etc.)

### Inventario de servidores (EC2 + ECS)

- Tabla dedicada con todas las instancias EC2 (AWS) y ECS (Huawei Cloud)
- **Columnas configurables estilo AWS**: icono de tuerca (Preferencias) que permite:
  - **Mostrar/ocultar columnas** con checkboxes (igual que AWS Console)
  - **Reordenar columnas con drag-and-drop** (arrastra el grip `⋮⋮` para mover)
  - Columnas fijas (Provider, Cuenta, Nombre) siempre visibles y bloqueadas
  - Separador visual entre columnas fijas y ordenables
  - Persistencia en `localStorage` (sobrevive recargas)
  - Boton "Restaurar" para volver al orden/visibilidad por defecto
- **Columnas personalizadas**: boton "Manage Columns" para crear, renombrar y eliminar columnas custom almacenadas en PostgreSQL
  - Celdas editables inline (click para editar, Enter para guardar, Escape para cancelar)
  - Aplicacion en bulk: seleccionar multiples servidores y aplicar un valor a una columna custom
- Ordenamiento por cualquier columna (asc/desc/none)
- Filtros por Proveedor, Estado y Cuenta
- Busqueda por nombre, ID, IPs, cuenta, tipo de instancia, OS
- Paginacion configurable (10, 50, 100, 500 por pagina)
- Scroll horizontal sincronizado (barra superior + tabla)
- Exportacion a Excel (.xlsx) y PDF con columnas custom incluidas
- Seleccion multiple con checkboxes para bulk operations
- Logos de provider (AWS / Huawei) inline en la tabla

### Monitoreo y Logs

- Agregacion de logs en tiempo real desde CloudWatch (AWS) y LTS (Huawei)
- Filtros avanzados (proveedor, cuenta, severidad, rango de tiempo)
- Dashboard de metricas (total logs, errores, warnings, info)
- Busqueda de logs
- Soporte multi-cuenta y multi-region

### Facturacion y Costos

- Integracion con AWS Cost Explorer
- Integracion con facturacion Huawei Cloud
- Desglose mensual por servicio
- Tendencias y proyeccion de costos
- Agregacion multi-cuenta

### Comandos remotos

- Ejecucion de comandos via AWS SSM Run Command
- Limites configurables (`COMMAND_MAX_TARGETS`, `COMMAND_MAX_LENGTH`)
- Auditoria de ejecucion (append-only)

### Terminal web

- Terminal interactiva basada en xterm.js
- Conexion a instancias via SSM

### Auditoria integral

- Registro append-only en PostgreSQL; triggers bloquean `UPDATE`, `DELETE` y `TRUNCATE`.
- Captura global de navegacion, cambios de pagina, clics, cambios de controles, teclado y drag-and-drop.
- Resultado de cada llamada interna a `/api/*`, incluyendo polling, validaciones y errores HTTP.
- Eventos autoritativos de login, logout, acceso denegado, lectura, exportacion y configuracion.
- CRUD de columnas y valores de servidores dentro de una transaccion; si no se puede auditar, el cambio se revierte.
- Ejecuciones SSM: intencion, rechazo por politica, comando bloqueado, resultado por target y Command ID.
- Migraciones aplicadas y su checksum quedan registradas como eventos de sistema/CLI.
- Correlacion por `requestId`, `operationId`, `clientSessionId`, `navigationId` e `interactionId`.
- UI de consulta con filtros por categoria, fuente, actor, accion, ruta, resultado, IP y fecha.
- Exportacion CSV de la auditoria.
- Nunca se capturan valores de inputs, passwords, cookies, tokens, ordenes de busqueda, comandos, stdout/stderr ni contenido de logs. Para valores custom y comandos se guardan HMAC, longitud y conteos.

### Perfil y temas

- 7 temas oscuros (Slate, Purple, Ocean, Sunset, Forest, Midnight, Cherry) + modo claro
- Selector de tema con preview
- Roles basados en grupos de Azure AD o admin local

---

## Tech Stack

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack, React 19, React Compiler) |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS v4 + CSS custom properties (glassmorphism, 7 temas) |
| UI Primitives | Radix UI (Select, Slot, Tabs) + shadcn/ui pattern (CVA, clsx, tailwind-merge) |
| Iconos | Lucide React |
| Animaciones | Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/modifiers |
| Graficos | Recharts |
| Tablas | @tanstack/react-table (disponible), tabla custom con ordenamiento/paginacion |
| Notificaciones | react-hot-toast |
| Auth | NextAuth.js v4 (Azure AD + admin local scrypt) |
| Cloud AWS | AWS SDK v3 (EC2, ECS, EKS, RDS, S3, Lambda, IAM, SSM, CloudWatch, Cost Explorer, etc.) |
| Cloud Huawei | Huawei Cloud SDK (ECS, VPC) + REST LTS/BSS |
| Base de datos | PostgreSQL 16 (pg driver, sin ORM) |
| Cifrado | AES-256-GCM (AEAD) para AK/SK; scrypt (OWASP) para passwords |
| Export | ExcelJS, jsPDF + autotable, xlsx, file-saver |
| Terminal | xterm.js |
| Cache | File-based (`data/*.json`) + @upstash/redis (opcional) |

---

## Arquitectura

```
                    Internet
                       |
                  ALB / Nginx (443)
                       |
              +--------+--------+
              |   app (3000)    |  Next.js standalone
              |  docker-entry   |  → migrate.mjs → server.js
              +--------+--------+
                       |
              +--------+--------+
              | postgres (5432) |  postgres:16-alpine
              |  /libre/devops/apps/database/data |  bind mount persistente
              +-----------------+
```

- **app**: imagen multi-stage (`Dockerfile`) con Next.js 16 en modo `standalone`. El `docker-entrypoint.sh` ejecuta `node /app/scripts/migrate.mjs` y **solo arranca si la migracion es exitosa**.
- **postgres**: `postgres:16-alpine` con **bind mount de produccion** `/libre/devops/apps/database/data` → `/var/lib/postgresql/data`. Los datos persisten en el host aunque se elimine el contenedor. En desarrollo local, `docker-compose.yml` usa `./db/data` por defecto.
- Red privada de Compose. Postgres **no expone puertos al host**. `DATABASE_URL` se construye dentro del Compose como `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`.
- Healthcheck HTTP: `GET /api/health` → `{"status":"ok"}`.

---

## Estructura del proyecto

```
mc-inventory/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API routes
│   │   │   ├── inventory/          # Inventario principal
│   │   │   ├── server-columns/     # CRUD columnas custom + reorder + values
│   │   │   ├── billing/            # Facturacion
│   │   │   ├── audit/              # Auditoria
│   │   │   ├── logs/               # Logs & monitoreo
│   │   │   ├── monitoring/         # Metricas CloudWatch/LTS
│   │   │   ├── ec2/                # Run Command (SSM)
│   │   │   └── health/             # Healthcheck
│   │   ├── servidores/             # Inventario de servidores (EC2+ECS)
│   │   ├── dashboard/              # Dashboard
│   │   ├── billing/                # Pagina facturacion
│   │   ├── comandos/               # Ejecucion de comandos
│   │   ├── monitoreo/              # Monitoreo y logs
│   │   ├── auditoria/              # Auditoria
│   │   ├── terminal/               # Terminal web
│   │   ├── profile/                # Perfil y temas
│   │   ├── login/                  # Login
│   │   ├── ClientLayout.tsx        # Layout con sidebar + header
│   │   └── page.tsx                # Home (inventario general)
│   ├── components/
│   │   ├── inventory/              # InventoryTable, InventoryCards, MetricsCards, ResourceModal, StatusBadge, etc.
│   │   ├── ui/                     # Primitivos UI (button, badge, card, input, select, tabs)
│   │   ├── layout/                 # Sidebar, UserMenu, BrandLogo, SiteFooter
│   │   ├── audit/                  # Componentes de auditoria
│   │   ├── billing/                # Componentes de facturacion
│   │   └── commands/               # Componentes de comandos
│   ├── lib/
│   │   ├── inventory/              # exportCsv, normalize, cache, formatTags, getStatusStyle, risk, topology
│   │   ├── secrets/                # AES-256-GCM + scrypt + fingerprints (crypto.ts)
│   │   ├── auth/                   # NextAuth config
│   │   ├── aws/                    # AWS SDK integrations + accounts.ts con descifrado
│   │   ├── huawei/                 # Huawei Cloud SDK integrations + accounts.ts con descifrado
│   │   ├── billing/                # Logica de facturacion
│   │   ├── audit/                  # Logica de auditoria
│   │   ├── monitoring/             # Logica de monitoreo
│   │   └── db/                     # Pool PostgreSQL
│   ├── types/                      # TypeScript types (InventoryItem, etc.)
│   └── services/aws/               # Servicios AWS
├── db/
│   ├── data/                       # Bind mount PostgreSQL (PERSISTENTE, gitignored)
│   └── migrations/                 # SQL migrations (001_audit_events, 006_server_columns)
├── scripts/
│   ├── migrate.mjs                 # Runner de migraciones idempotente
│   └── secrets.mjs                 # CLI: generate-key | encrypt | decrypt | hash-password | migrate-env
├── public/logos/                   # SVG logos AWS + Huawei
├── data/                           # Cache JSON (gitignored, efimero)
├── docker-compose.yml              # Compose: app + postgres con bind mount
├── Dockerfile                      # Multi-stage: deps → prod-deps → builder → runner
├── docker-entrypoint.sh            # migrate → server.js (falla si migracion falla)
├── .env.example                    # Template de variables (commiteado)
├── .env.master.key                 # Master key AES-256 (gitignored, chmod 600)
└── package.json
```

---

## Prerrequisitos

- Node.js 20+ y npm
- Docker Engine + Compose v2 (para despliegue)
- Cuenta(s) AWS con permisos IAM apropiados
- Cuenta(s) Huawei Cloud con AK/SK
- Variables de entorno configuradas (ver `.env.example`)

---

## Inicio rapido (desarrollo local)

### 1. Clonar e instalar

```bash
git clone <repository-url>
cd mc-inventory
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con tus credenciales (cifradas como ENC:v1:...)
```

### 3. Migrar la base de datos

```bash
npm run db:migrate
```

### 4. Arrancar en modo desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### 5. Docker local (opcional)

```bash
docker compose up --build -d
# App en http://localhost:3000
# Datos de Postgres en ./db/data/ (persistente)
```

---

## Cifrado de secretos

> **Concepto clave:** lo "encriptado sin posibilidad de desencriptar" solo existe como **hash**, y un hash de una AK/SK la vuelve **inutilizable** (la app ya no podria firmar peticiones a AWS/Huawei). Por eso el proyecto separa dos casos:

| Secreto | Metodo | Reversible | Donde |
|---|---|---|---|
| AK/SK y secrets operativos | **AES-256-GCM** (AEAD, NIST) con master key 256 bits | Si, solo en memoria | `ENC:v1:...` en `.env` |
| Password admin local | **scrypt** (N=16384, r=8, p=1, OWASP) | **No, irreversible** | `LOCAL_ADMIN_PASSWORD_HASH=scrypt$...` |

- En disco **nunca hay texto plano**: las AK/SK viven como `ENC:v1:<iv>:<tag>:<ct>` y el password solo como hash. La app descifra **unicamente en memoria** (`src/lib/secrets/crypto.ts`).
- Excepcion: `POSTGRES_PASSWORD` queda en texto plano porque el contenedor `postgres` lo necesita para bootstrapping. Solo local (gitignored); en produccion inyectar desde secret manager.
- La master key vive en `.env.master.key` (gitignored, `chmod 600`) o en el secret manager en produccion. **Jamas se commitea.**

Comandos (`scripts/secrets.mjs`, sin dependencias externas):

```bash
node scripts/secrets.mjs generate-key              # master key base64 (32 bytes)
node scripts/secrets.mjs encrypt "<valor>"         # → ENC:v1:... (requiere CREDENTIALS_MASTER_KEY)
node scripts/secrets.mjs decrypt "<ENC:v1:...>"    # verificacion puntual
node scripts/secrets.mjs hash-password "<pass>"    # → scrypt$... (irreversible)
node scripts/secrets.mjs migrate-env --write       # cifra .env y .env.local en su lugar
# Atajos npm: secrets:key | secrets:encrypt | secrets:hash | secrets:migrate
```

Flujo para agregar/rotar una key:

```bash
node scripts/secrets.mjs encrypt "AKIA..."     # → copiar el ENC:v1:...
# pegar en .env como AWS_ACCOUNT_3_ACCESS_KEY=ENC:v1:...
# recrear en produccion: ./scripts/deploy.sh (o npm run dev en local)
```

> **Trampa de Docker Compose con `$`:** compose interpola `$VAR` incluso dentro del `.env`. El hash scrypt contiene `$`, asi que **en `.env` se guarda con `$$`**; compose lo desescapa a `$` dentro del contenedor. Los valores `ENC:v1:...` (base64) no contienen `$` y son seguros. `LOCAL_ADMIN_PASSWORD_HASH` **no** se lista en el bloque `environment:` del Compose: llega literal via `env_file`.

Tras migrar secretos que estuvieron en texto plano, **rotalos** en las consolas de AWS/Huawei.

---

## Despliegue productivo en Amazon Linux 2023

Guia para un servidor **Amazon Linux 2023** con Docker, con el proyecto en la ruta fija:

```
/libre/devops/apps/MC-inventory/
```

### 1. Requisitos del servidor

- Amazon Linux 2023 (x86_64 o ARM, las imagenes `node:20-alpine` y `postgres:16-alpine` son multi-arch).
- Docker Engine + plugin Compose v2, Git, `openssl`.
- DNS apuntando al servidor (ej. `inventario.tudominio.com`) y certificado TLS (recomendado: ALB + ACM; alternativo: Nginx + certbot).
- Security Group: abrir `80/443` al mundo, **no abrir `3000` ni `5432`** salvo administracion temporal.
- Disco: minimo 20 GB libres (imagenes + datos PG + logs).

Instalacion en Amazon Linux 2023:

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
sudo mkdir -p /libre/devops/apps/MC-inventory
sudo chown -R $USER:$USER /libre/devops/apps/MC-inventory
cd /libre/devops/apps/MC-inventory

# Opcion A: clonar
git clone <repository-url> .
# Opcion B: copiar desde tu PC (ej. scp/rsync)
```

El directorio debe contener `docker-compose.yml`, `Dockerfile`, `docker-entrypoint.sh`, `db/migrations/`, `scripts/migrate.mjs`, `src/`.

### 3. Variables de entorno de produccion

Compose **requiere** un archivo `.env` junto al `docker-compose.yml` (no usa `.env.local`). Minimo obligatorio:

| Variable | Produccion |
|---|---|
| `APP_PORT` | `3000` (interno; no exponer directo, ir detras de ALB/Nginx) |
| `POSTGRES_DB` / `POSTGRES_USER` | ej. `mc_inventory` / `mc_inventory` |
| `POSTGRES_PASSWORD` | >= 24 caracteres aleatorios, sin `:` `/` `@` `#` (rompen la `DATABASE_URL`) |
| `NEXTAUTH_URL` | URL publica **https**, ej. `https://inventario.tudominio.com` |
| `NEXTAUTH_SECRET` | >= 32 caracteres aleatorios, **cifrado** como `ENC:v1:...` |
| `AUDIT_HASH_SECRET` | >= 32 caracteres aleatorios, distinto del anterior, **cifrado** como `ENC:v1:...` |
| `CREDENTIALS_MASTER_KEY` | **No va en `.env`.** Va en `.env.master.key` junto al compose (o secret manager). |
| `LOCAL_ADMIN_PASSWORD_HASH` | Hash scrypt del password admin, con `$` escapados como `$$` en `.env`. |
| `AWS_ACCOUNT_*_ACCESS_KEY` / `SECRET_KEY` | **Cifradas** como `ENC:v1:...` |
| `HUAWEI_ACCOUNT_*_AK` / `SK` | **Cifradas** como `ENC:v1:...` |
| `DATABASE_SSL` | `disable` si usas el `postgres` del Compose; `require` solo con RDS/TLS |

Generar secretos en el servidor (no reutilizar los de desarrollo):

```bash
cd /libre/devops/apps/MC-inventory
openssl rand -base64 32  # POSTGRES_PASSWORD (quitar :/@# si aparecen)
node scripts/secrets.mjs generate-key  # CREDENTIALS_MASTER_KEY → guardar en .env.master.key
```

Crear `.env` y `.env.master.key`:

```bash
cp .env.example .env
chmod 600 .env
node scripts/secrets.mjs generate-key > .env.master.key
# editar .env.master.key → dejar solo: CREDENTIALS_MASTER_KEY=<clave>
chmod 600 .env.master.key
# Cifrar cada secreto y pegarlo como ENC:v1:... :
node scripts/secrets.mjs encrypt "<NEXTAUTH_SECRET>"
node scripts/secrets.mjs encrypt "<AUDIT_HASH_SECRET>"
node scripts/secrets.mjs encrypt "<AWS_SECRET_KEY>"   # repetir por cada AK/SK
# Hashear el password admin (escapar $ como $$ al pegar en .env):
node scripts/secrets.mjs hash-password "<password-admin>"
```

### 4. Arranque

En produccion se debe usar siempre el override `docker-compose.prod.yml`, que fija el volumen PostgreSQL en `/libre/devops/apps/database/data/`:

```bash
cd /libre/devops/apps/MC-inventory
export COMPOSE_PROJECT_NAME=mc-inventory
COMPOSE="docker compose --project-name mc-inventory -f docker-compose.yml -f docker-compose.prod.yml"

# Valida la configuracion sin imprimir secretos
$COMPOSE config --quiet

# Construye la imagen de app y levanta ambos servicios
# El comando directo evita depender de una version antigua de buildx en servidores.
docker build --pull -t mc-inventory-app:latest .
$COMPOSE up -d --no-build
$COMPOSE ps
$COMPOSE logs --tail 200 -f app
curl -fsS http://127.0.0.1:3000/api/health  # {"status":"ok"}
```

Para el primer arranque, el directorio `/libre/devops/apps/database/data/` debe existir. Si se esta trasladando una base desde otro volumen o backup, validar el restore **antes** de iniciar la app. No borrar nunca el directorio de datos.

Verificar BD y migracion:

```bash
$COMPOSE exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\\dt"'
$COMPOSE exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT name, applied_at FROM schema_migrations ORDER BY name;"'
```

Si el log de `app` muestra `Database migration failed`, el contenedor no arranca (por diseno). Revisa credenciales `POSTGRES_*`, conectividad y `DATABASE_SSL`.

### 5. Exposicion HTTPS

Recomendado: **ALB + ACM** delante del host, target group al puerto `3000`, `NEXTAUTH_URL=https://...`.

Alternativa con Nginx en el mismo host:

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

Tras cambiar `NEXTAUTH_URL`, recrear la app con el override de produccion: `docker compose --project-name mc-inventory -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build --no-deps --force-recreate app`.

### 6. Operacion diaria y actualizaciones

En produccion la BD vive en el **bind mount** `/libre/devops/apps/database/data/` del host, mapeado a `/var/lib/postgresql/data` dentro del contenedor postgres. El override `docker-compose.prod.yml` es obligatorio; `docker-compose.yml` sin el override usa `./db/data/` para desarrollo local.

**Persistencia de datos:**
- `docker compose down` conserva los datos del bind mount.
- Eliminar o recrear el contenedor `app` no toca PostgreSQL.
- No usar `docker compose down -v`, `docker volume rm` ni `rm -rf /libre/devops/apps/database/data/`.

#### Validar el volumen persistente

```bash
cd /libre/devops/apps/MC-inventory
./scripts/deploy.sh --check
```

El script comprueba que el contenedor este `healthy`, que el mount apunte exactamente a `/libre/devops/apps/database/data/` y que la version sea PostgreSQL 16. Para una comprobacion manual:

```bash
docker inspect mc-inventory-postgres-1 \
  --format '{{range .Mounts}}{{println .Type .Source "->" .Destination}}{{end}}'
docker exec mc-inventory-postgres-1 cat /var/lib/postgresql/data/PG_VERSION
du -sh /libre/devops/apps/database/data
```

El resultado esperado es `bind /libre/devops/apps/database/data -> /var/lib/postgresql/data` y `16`.

#### Actualizar solo la aplicacion (procedimiento recomendado)

```bash
cd /libre/devops/apps/MC-inventory
git pull --ff-only
./scripts/deploy.sh
```

O en un solo paso:

```bash
./scripts/deploy.sh --pull
```

El script valida PostgreSQL, crea un dump logico en `/libre/devops/backups/`, construye la imagen de `app`, ejecuta `up -d --no-deps --force-recreate app` y espera `/api/health`. No reconstruye, elimina ni reinicia el contenedor de PostgreSQL. La migracion SQL se ejecuta automaticamente al arrancar la nueva app y el script comprueba que el ID del contenedor PostgreSQL no haya cambiado.

#### Equivalente manual

```bash
cd /libre/devops/apps/MC-inventory
git pull --ff-only
docker build --pull -t mc-inventory-app:latest .
docker compose --project-name mc-inventory \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-build --no-deps --force-recreate app
docker compose --project-name mc-inventory \
  -f docker-compose.yml -f docker-compose.prod.yml \
  logs -f app
```

No usar `docker compose down` como paso de la actualizacion. Si se detiene todo, `docker compose down` conserva el bind mount, pero el script de actualizacion es mas seguro porque no detiene PostgreSQL.

> **Nunca** borrar `/libre/devops/apps/database/data/` sin un backup verificado.
> Si se migra desde el volumen Docker antiguo `mc-inventory_postgres_data`, conservar ese volumen hasta validar el restore; no eliminarlo durante la transicion.

### 7. Backups

Dump logico (recomendado, programar en cron diario):

```bash
cd /libre/devops/apps/MC-inventory
COMPOSE="docker compose --project-name mc-inventory -f docker-compose.yml -f docker-compose.prod.yml"
sudo mkdir -p /libre/devops/backups
$COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > /libre/devops/backups/mc-inventory-$(date +%F).dump
```

Restaurar (con backup verificado y ventana de mantenimiento):

```bash
cat /ruta/al/backup.dump | $COMPOSE exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean'
```

Cron diario (02:30) con limpieza de dumps > 7 dias:

```bash
crontab -e
# 30 2 * * * cd /libre/devops/apps/MC-inventory && mkdir -p /libre/devops/backups && docker compose --project-name mc-inventory -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /libre/devops/backups/mc-inventory-$(date +\%F).dump && find /libre/devops/backups -name 'mc-inventory-*.dump' -mtime +7 -delete
```

Verificar un backup sin restaurar (no requiere `pg_restore` instalado en el host):

```bash
docker run --rm -v /libre/devops/backups:/backup:ro postgres:16-alpine \
  pg_restore --list /backup/mc-inventory-YYYY-MM-DD.dump | grep -c "TABLE DATA"
```

Retencion sugerida: 7 diarios + 4 semanales, fuera del host (S3). Probar restore al menos una vez.

### 8. Endurecimiento y checklist pre-produccion

- [ ] `.env` con `chmod 600`, propietario correcto, fuera de Git y respaldado en Secrets Manager/SSM.
- [ ] `ALLOWED_USERS`, `AZURE_AD_ALLOWED_DOMAIN` / `AZURE_AD_ALLOWED_DOMAINS` o `AZURE_AD_ALLOWED_GROUPS` configurados; en produccion no se permite Azure AD abierto.
- [ ] `LOCAL_ADMIN_PASSWORD` eliminado despues de migrar a `LOCAL_ADMIN_PASSWORD_HASH`; rotar secretos expuestos.
- [ ] `NEXTAUTH_URL` https publica, `NEXTAUTH_SECRET` y `AUDIT_HASH_SECRET` fuertes y distintos.
- [ ] `POSTGRES_PASSWORD` fuerte, sin caracteres que rompan la URL.
- [ ] `DATABASE_SSL=disable` solo con postgres de Compose en red privada; `require` + CA si es RDS/TLS.
- [ ] Puertos `3000`/`5432` no publicados a internet (SG + sin `ports` extra en Compose).
- [ ] `restart: unless-stopped` activo y Docker con `systemctl enable`.
- [ ] Reloj NTP y zona horaria del host correctos (auditoria usa `timestamptz`).
- [ ] Logs rotados (`/etc/docker/daemon.json` con `log-driver` + `max-size`, ej. `10m`/`3`).
- [ ] Espacio en disco monitorizado; `data/*.json` es cache local efimero, no respaldo.
- [ ] Rotacion de secretos definida; `AUDIT_HASH_SECRET` solo en ventana de mantenimiento.
- [ ] Acceso SSH con key, sin password; usuarios minimos.
- [ ] Bind mount `/libre/devops/apps/database/data/` con permisos adecuados (postgres necesita ownership del directorio).
- [ ] Backup de BD verificado y cron programado.

### 9. Troubleshooting

| Sintoma | Causa probable / solucion |
|---|---|
| `POSTGRES_* is required` al hacer `config/up` | Falta variable en `.env` o `.env` en otra ruta. Validar con `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet` |
| `permission denied` con docker | Falta `usermod -aG docker`, re-login SSH, o usar `sudo` |
| `port 3000 already in use` | Otro proceso/contenedor. `ss -tlnp \| grep 3000`, cambiar `APP_PORT` o detener el otro servicio |
| App en loop / `migration failed` | Credenciales PG, `DATABASE_SSL` incorrecto, o migracion SQL con error. Ver `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail 200 app` |
| `CREDENTIALS_MASTER_KEY no configurada` | Falta `.env.master.key` junto al compose. Generar con `node scripts/secrets.mjs generate-key` |
| Warnings `variable "..." is not set` con `docker compose up` | Un valor del `.env` contiene `$` sin escapar (tipico: hash scrypt). Usar `$$` en `LOCAL_ADMIN_PASSWORD_HASH` |
| Login redirige a localhost | `NEXTAUTH_URL` sigue en `http://localhost:3000`. Poner la URL publica y recrear |
| Office 365 responde `AccessDenied` | Microsoft autentico la cuenta, pero la app no encontro coincidencia. Revisar `ALLOWED_USERS` (tiene prioridad), `AZURE_AD_ALLOWED_DOMAIN` / `AZURE_AD_ALLOWED_DOMAINS` o `AZURE_AD_ALLOWED_GROUPS`, recrear el contenedor y consultar el log `[auth] Azure AD sign-in denied`, que informa el motivo sin incluir el correo |
| `audit_events is append-only` | Normal: la tabla es solo-apendice por trigger |
| Disco lleno | `docker system df`, `docker image prune`, podar logs, ampliar EBS |
| `Conflict. The container name ... is already in use` | Contenedor huerfano. Verificar el proyecto y ejecutar el comando de update de este README; no usar `docker compose down -v` |
| Postgres no arranca / `data directory has wrong ownership` | Permisos del bind mount de produccion. No borrar datos: `sudo chown -R 70:70 /libre/devops/apps/database/data` (UID/GID de postgres en `postgres:16-alpine`) y volver a validar. |
| Tras `down`, ¿se pierden los registros? | No, los datos estan en `/libre/devops/apps/database/data/` (bind mount). Verificar: `du -sh /libre/devops/apps/database/data` |

---

## Seguridad

- AK/SK y secrets operativos se guardan **cifrados con AES-256-GCM** (`ENC:v1:...`) y solo se descifran en memoria (`src/lib/secrets/crypto.ts`). El password admin local se guarda con **hash irreversible scrypt** (`LOCAL_ADMIN_PASSWORD_HASH`); nunca como texto plano.
- Never commit `.env`, `.env.local` ni `.env.master.key` to version control (los tres estan en `.gitignore`; solo `.env.example` con placeholders se commitea). El backup de secretos va al gestor de secretos (AWS Secrets Manager / SSM Parameter Store), no a Git.
- Use IAM roles with least privilege principle.
- Implement proper authentication with NextAuth.js.
- Do not store commands, command output, passwords, tokens, cookies, authorization headers or cloud keys in audit records. La aplicacion registra solo HMAC, longitud y conteos para operaciones sensibles.
- La auditoria de UI/API genera eventos continuamente. Vigilar crecimiento, definir retencion y respaldar `audit_events` sin permitir UPDATE/DELETE al rol de la aplicacion.
- Use `npm run db:migrate` for every schema change; migration names are tracked in `schema_migrations`.
- Rotate `NEXTAUTH_SECRET`, `AUDIT_HASH_SECRET`, PostgreSQL credentials and cloud credentials through the secret manager.
- Keep PostgreSQL off the host network unless temporary administrative access is explicitly required and protected by TLS and network controls.

---

## Permisos IAM requeridos

### AWS IAM Permissions

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

- ECS (Elastic Cloud Server)
- CCE (Cloud Container Engine)
- RDS (Relational Database Service)
- DDS (Document Database Service)
- OBS (Object Storage Service)
- LTS (Log Tank Service)
- BSS (Billing)

---

## Licencia

MIT License
