# Sistema de Caché para Monitoreo AWS

## 📋 Descripción

El módulo de monitoreo implementa un sistema de caché inteligente similar al de billing e inventory, diseñado para manejar eficientemente las métricas de **37+ cuentas de AWS** sin sobrecargar las APIs de CloudWatch.

## 🎯 Características Principales

### 1. **Caché Persistente**

- Archivo: `data/monitoring-cache.json`
- Almacena métricas de EC2, RDS y ECS de todas las cuentas
- TTL (Time To Live): 60 segundos
- Actualización automática en background

### 2. **Background Job**

- Actualización automática cada **60 segundos**
- Procesamiento en lotes (5 cuentas a la vez)
- No bloquea las peticiones de la API
- Gestión de errores por cuenta individual

### 3. **Recolección Paralela**

- Procesa múltiples cuentas simultáneamente
- Manejo de errores graceful (si una cuenta falla, las demás continúan)
- Optimizado para 37+ cuentas

## 📂 Estructura de Archivos

```
src/lib/monitoring/
├── cache.ts           # Funciones de lectura/escritura del caché
├── collector.ts       # Recolección de métricas de AWS
└── background.ts      # Job de actualización automática

src/app/api/monitoring/
├── metrics/route.ts   # API principal de métricas (usa caché)
└── background/route.ts # Control del background job

data/
└── monitoring-cache.json  # Archivo de caché (generado automáticamente)
```

## 🚀 Uso

### API de Métricas

**Obtener todas las cuentas:**

```bash
GET /api/monitoring/metrics
```

**Respuesta:**

```json
{
  "success": true,
  "source": "cache",
  "timestamp": 1704912000000,
  "cacheAge": 45000,
  "refreshing": false,
  "backgroundJob": {
    "running": true,
    "refreshing": false,
    "interval": 60000
  },
  "summary": {
    "totalAccounts": 37,
    "totalEC2": 152,
    "runningEC2": 89,
    "totalRDS": 45,
    "availableRDS": 42,
    "totalECSClusters": 23,
    "totalECSTasks": 187
  },
  "accounts": {
    "264450776943": {
      "accountId": "264450776943",
      "accountName": "MC Inventory",
      "region": "us-east-1",
      "ec2": { ... },
      "rds": { ... },
      "ecs": { ... },
      "lastUpdated": 1704912000000
    },
    ...
  }
}
```

**Obtener cuenta específica:**

```bash
GET /api/monitoring/metrics?accountId=264450776943
```

**Forzar actualización:**

```bash
GET /api/monitoring/metrics?refresh=true
```

### API de Control del Background Job

**Ver estado:**

```bash
GET /api/monitoring/background
```

**Iniciar job:**

```bash
POST /api/monitoring/background
Content-Type: application/json

{
  "action": "start"
}
```

**Detener job:**

```bash
POST /api/monitoring/background
Content-Type: application/json

{
  "action": "stop"
}
```

**Forzar actualización inmediata:**

```bash
POST /api/monitoring/background
Content-Type: application/json

{
  "action": "refresh"
}
```

## 📊 Estructura del Caché

```json
{
  "timestamp": 1704912000000,
  "data": {
    "accounts": {
      "264450776943": {
        "accountId": "264450776943",
        "accountName": "MC Inventory",
        "region": "us-east-1",
        "ec2": {
          "instances": [
            {
              "instanceId": "i-1234567890abcdef0",
              "instanceType": "t3.medium",
              "state": "running",
              "cpuUtilization": 45.2,
              "networkIn": 1024000,
              "networkOut": 2048000
            }
          ],
          "summary": {
            "total": 10,
            "running": 8,
            "stopped": 2,
            "avgCpu": 35.5
          }
        },
        "rds": {
          "ances": [ ... ],
          "summary": { ... }
        },
        "ecs": {
          "clusters": [ ... ],
          "summary": { ... }
        },
        "lastUpdated": 1704912000000
      }
    }
  }
}
```

## ⚙️ Configuración

### Variables de Entorno

Las cuentas de AWS se configuran en `.env`:

```env
## AWS - Account 1
AWS_ACCOUNT_1_NAME=MC Inventory
AWS_ACCOUNT_1_ID=264450776943
AWS_ACCOUNT_1_ACCESS_KEY=AKIAT3ET6T5X35PI6GFW
AWS_ACCOUNT_1_SECRET_KEY=***

## AWS - Account 2
AWS_ACCOUNT_2_NAME=invictus-dev
AWS_ACCOUNT_2_ID=171158266043
AWS_ACCOUNT_2_ACCESS_KEY=AKIASPWOT4C5TU2KC3NU
AWS_ACCOUNT_2_SECRET_KEY=***

# ... hasta 37+ cuentas
```

### Parámetros Configurables

En `src/lib/monitoring/background.ts`:

```typescript
const REFRESH_INTERVAL = 60 * 1000; // 1 minuto
```

En `src/app/api/monitoring/metrics/route.ts`:

```typescript
const CACHE_TTL = 60 * 1000; // 1 minuto
```

En `src/lib/monitoring/collector.ts`:

```typescript
const METRIC_PERIOD = 300; // 5 minutos (periodo de métricas)
const batchSize = 5; // Cuentas procesadas en paralelo
```

## 🔄 Flujo de Trabajo

1. **Primera solicitud:**
   - No hay caché → Recolecta métricas de todas las cuentas
   - Guarda en `monitoring-cache.json`
   - Inicia el background job
   - Retorna datos frescos

2. **Solicitudes subsecuentes:**
   - Lee el caché
   - Si el caché tiene < 60s → Retorna caché + inicia refresh en background
   - Si el caché tiene > 60s → Retorna caché + ya está refrescando

3. **Background Job:**
   - Se ejecuta cada 60 segundos
   - Recolecta métricas de todas las cuentas en paralelo
   - Actualiza el archivo de caché
   - Continúa indefinidamente

## 📈 Ventajas del Sistema

1. **Performance:**
   - Respuesta instantánea (< 100ms vs 10-30s sin caché)
   - No hay timeouts en la API
   - Escalable a 37+ cuentas

2. **Confiabilidad:**
   - Manejo de errores por cuenta
   - Si una cuenta falla, las demás continúan
   - El caché persiste entre reinicios

3. **Eficiencia:**
   - Reduce llamadas a AWS CloudWatch
   - Ahorro en costos de API
   - Menor carga en las cuentas de AWS

4. **User Experience:**
   - UI siempre responsiva
   - Indicador de edad del caché
   - Opción de forzar actualización
   - Estado del background job visible

## 🐛 Troubleshooting

### El caché no se crea

**Verificar:**

- Permisos de escritura en la carpeta `data/`
- Credenciales de AWS válidas
- Logs del servidor: `[MONITORING]` prefix

### El background job no inicia

**Solución:**

```bash
POST /api/monitoring/background
{
  "action": "start"
}
```

### Métricas desactualizadas

**Verificar edad del caché:**

```bash
GET /api/monitoring/metrics
# Ver campo "cacheAge" en la respuesta
```

**Forzar actualización:**

```bash
GET /api/monitoring/metrics?refresh=true
```

### Errores en cuentas específicas

**Ver logs:**

```
[MONITORING] ✓ MC Inventory collected
[MONITORING] ✗ invictus-dev failed: AccessDenied
```

**Solución:**

- Verificar credenciales de la cuenta con error
- Verificar permisos IAM

## 🔐 Permisos IAM Requeridos

Las cuentas de AWS necesitan estos permisos mínimos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "ec2:DescribeInstances",
        "rds:DescribeDBInstances",
        "ecs:ListClusters",
        "ecs:DescribeClusters"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📊 Dashboard de Monitoreo

El componente `MonitoringDashboard` muestra:

- ✅ Estado del caché (edad, fuente)
- ✅ Estado del background job
- ✅ Resumen de todas las cuentas
- ✅ Métricas agregadas (EC2, RDS, ECS)
- ✅ Última actualización
- ✅ Botón de refresh manual

## 🎯 Próximas Mejoras

- [ ] Alertas personalizadas por umbrales
- [ ] Histórico de métricas (últimas 24h)
- [ ] Gráficos de tendencias
- [ ] Exportación de métricas a CSV
- [ ] Notificaciones por email/Slack
- [ ] Métricas de Lambda, S3, etc.

---

**Documentación actualizada:** Enero 2025
