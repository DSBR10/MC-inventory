# Módulo de Monitoreo AWS

Este módulo permite monitorear métricas, logs y eventos de AWS en tiempo real utilizando CloudWatch, CloudWatch Logs y CloudTrail.

## Características

### 1. **Métricas de AWS**

- **EC2 Instances**: CPU, Network, Disk I/O
- **RDS Databases**: CPU, Connections, Memory, Storage, Latency, Throughput
- **ECS Services**: CPU Utilization, Memory Utilization

### 2. **Logs de AWS**

- **CloudWatch Logs**: Visualización de logs de aplicaciones y servicios
- **CloudTrail**: Auditoría de eventos y acciones en AWS

## Configuración

### 1. Variables de Entorno

Agrega las siguientes variables en tu archivo `.env.local`:

```env
# Región por defecto
AWS_REGION=us-east-1

# Credenciales de AWS
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key

# Configuración opcional
MAX_LOGS_LIMIT=1000
LOG_RETENTION_DAYS=7
```

### 2. Permisos IAM Requeridos

El usuario IAM debe tener los siguientes permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "logs:FilterLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "cloudtrail:LookupEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

## Uso

### 1. Acceso al Módulo

Navega a la sección de **Monitoreo** en la aplicación y selecciona una de las pestañas:

- **Vista General**: Métricas generales del sistema
- **Métricas AWS**: Métricas específicas de servicios AWS
- **Logs AWS**: Logs de CloudWatch y eventos de CloudTrail

### 2. Consultar Métricas

#### EC2 Instances

1. Selecciona "EC2 Instances" en el tipo de servicio
2. Ingresa el Instance ID (ej: `i-1234567890abcdef0`)
3. Selecciona la región
4. Haz clic en "Obtener Métricas"

Métricas disponibles:

- CPU Utilization (%)
- Network In (Bytes)
- Network Out (Bytes)
- Disk Read (Bytes)
- Disk Write (Bytes)

#### RDS Databases

1. Selecciona "RDS Databases" en el tipo de servicio
2. Ingresa el DB Instance Identifier (ej: `my-database`)
3. Selecciona la región
4. Haz clic en "Obtener Métricas"

Métricas disponibles:

- CPU Utilization (%)
- Database Connections
- Freeable Memory
- Free Storage Space
- Read/Write Latency
- Read/Write Throughput

#### ECS Services

1. Selecciona "ECS Services" en el tipo de servicio
2. Ingresa el Cluster Name
3. Ingresa el Service Name
4. Selecciona la región
5. Haz clic en "Obtener Métricas"

Métricas disponibles:

- CPU Utilization (%)
- Memory Utilization (%)

### 3. Consultar Logs

#### CloudWatch Logs

1. Ve a la pestaña "Logs AWS"
2. Selecciona "CloudWatch Logs"
3. Selecciona la región
4. Selecciona un Log Group de la lista
5. (Opcional) Configura filtros:
   - Fecha de inicio/fin
   - Patrón de filtro (ej: `[ERROR]`, `Exception`)
6. Haz clic en "Buscar Logs"

#### CloudTrail Events

1. Ve a la pestaña "Logs AWS"
2. Selecciona "CloudTrail"
3. Selecciona la región
4. (Opcional) Configura filtros:
   - Usuario
   - Nombre del evento (ej: `CreateBucket`, `DeleteInstance`)
   - Fecha de inicio/fin
5. Haz clic en "Buscar Eventos"

## API Endpoints

### Métricas

```
GET /api/monitoring/aws/metrics
```

Parámetros:

- `serviceType`: `ec2` | `rds` | `ecs`
- `resourceId`: ID del recurso
- `serviceName`: (Solo para ECS) Nombre del servicio
- `region`: Región de AWS
- `period`: Período de agregación en segundos (default: 300)

Ejemplo:

```bash
GET /api/monitoring/aws/metrics?serviceType=ec2&resourceId=i-123456&region=us-east-1
```

### CloudWatch Logs

```
GET /api/monitoring/aws/cloudwatch-logs
```

Parámetros:

- `logGroupName`: Nombre del log group (opcional, si no se envía lista todos)
- `region`: Región de AWS
- `startTime`: Fecha de inicio (ISO 8601)
- `endTime`: Fecha de fin (ISO 8601)
- `filterPattern`: Patrón de filtro
- `limit`: Número máximo de logs (default: 100)

### CloudTrail

```
GET /api/monitoring/aws/cloudtrail
```

Parámetros:

- `region`: Región de AWS
- `startTime`: Fecha de inicio (ISO 8601)
- `endTime`: Fecha de fin (ISO 8601)
- `username`: Filtrar por usuario
- `resourceType`: Filtrar por tipo de recurso
- `eventName`: Filtrar por nombre de evento
- `maxResults`: Número máximo de eventos (default: 50)

## Arquitectura

### Servicios

- **CloudWatchMetricsService**: Maneja la obtención de métricas de CloudWatch
- **CloudWatchLogsService**: Maneja la consulta de logs de CloudWatch
- **CloudTrailService**: Maneja la consulta de eventos de CloudTrail

### Componentes

- **AWSMetricsView**: Componente para visualizar métricas en gráficos
- **AWSLogsView**: Componente para visualizar logs y eventos

### Tipos

Todos los tipos TypeScript están definidos en `src/types/monitoring-aws.ts`

## Troubleshooting

### Error: "Failed to fetch metrics"

**Causas comunes:**

1. Credenciales incorrectas o sin permisos
2. Región incorrecta
3. Resource ID no existe

**Solución:**

- Verifica las credenciales en `.env.local`
- Verifica que el recurso existe en la región especificada
- Revisa los permisos IAM

### Error: "No hay datos disponibles"

**Causas comunes:**

1. El recurso no tiene métricas en el período consultado
2. El recurso está detenido
3. CloudWatch no ha recibido métricas aún

**Solución:**

- Verifica que el recurso esté activo
- Espera algunos minutos para que CloudWatch recopile datos
- Ajusta el rango de tiempo consultado

### Logs no aparecen

**Causas comunes:**

1. Log Group no tiene logs en el período
2. Filtro demasiado restrictivo
3. Permisos insuficientes

**Solución:**

- Verifica que el Log Group tenga logs
- Ajusta o elimina los filtros
- Verifica los permisos IAM

## Mejoras Futuras

- [ ] Agregar alertas configurables
- [ ] Exportar métricas a CSV/PDF
- [ ] Dashboard personalizable
- [ ] Comparación de métricas entre recursos
- [ ] Métricas de Lambda, S3, y otros servicios
- [ ] Integración con sistemas de notificación
- [ ] Retención automática de métricas históricas
- [ ] Análisis de tendencias y predicciones

## Soporte

Para reportar problemas o sugerencias, por favor crea un issue en el repositorio del proyecto.
