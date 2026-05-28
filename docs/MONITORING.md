# Módulo de Monitoreo de AWS

Este módulo permite monitorear métricas y logs de múltiples servicios de AWS desde una interfaz centralizada.

## Características

### 1. Monitoreo de Métricas

#### EC2 (Elastic Compute Cloud)

- CPU Utilization
- Network In/Out
- Disk Read/Write Operations
- Status Check Failed

#### RDS (Relational Database Service)

- CPU Utilization
- Database Connections
- Freeable Memory
- Free Storage Space
- Read/Write IOPS
- Read/Write Latency

#### ECS (Elastic Container Service)

- CPU Utilization
- Memory Utilization
- Task Count
- Service Running Count

### 2. Visualización de Logs

#### CloudWatch Logs

- Búsqueda de logs por Log Group
- Filtrado por rango de tiempo
- Búsqueda por patrones

#### CloudTrail

- Eventos de auditoría
- Acciones de usuarios y servicios
- Cambios en recursos

## Configuración

### Variables de Entorno

El módulo soporta múltiples cuentas de AWS. Configura cada cuenta en tu archivo `.env`:

```env
# Región por defecto
AWS_REGION=us-east-1

# Cuenta AWS 1
AWS_ACCOUNT_1_NAME=MC Inventory
AWS_ACCOUNT_1_ID=264450776943
AWS_ACCOUNT_1_ACCESS_KEY=YOUR_ACCESS_KEY
AWS_ACCOUNT_1_SECRET_KEY=YOUR_SECRET_KEY

# Cuenta AWS 2
AWS_ACCOUNT_2_NAME=invictus-dev
AWS_ACCOUNT_2_ID=171158266043
AWS_ACCOUNT_2_ACCESS_KEY=YOUR_ACCESS_KEY
AWS_ACCOUNT_2_SECRET_KEY=YOUR_SECRET_KEY

# ... Puedes agregar más cuentas siguiendo el mismo patrón
```

### Permisos IAM Necesarios

Las credenciales de AWS deben tener los siguientes permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "cloudtrail:LookupEvents",
        "ec2:DescribeInstances",
        "rds:DescribeDBInstances",
        "ecs:DescribeClusters",
        "ecs:DescribeServices",
        "ecs:ListClusters",
        "ecs:ListServices"
      ],
      "Resource": "*"
    }
  ]
}
```

## Uso

### 1. Acceder al Módulo de Monitoreo

Navega a `/monitoring` en tu aplicación.

### 2. Seleccionar Cuenta AWS

En la interfaz, selecciona la cuenta de AWS que deseas monitorear desde el dropdown de cuentas.

### 3. Ver Métricas

1. Selecciona el tipo de servicio (EC2, RDS o ECS)
2. Ingresa el ID del recurso:
   - EC2: Instance ID (ej: `i-1234567890abcdef0`)
   - RDS: DB Instance Identifier (ej: `my-database`)
   - ECS: Cluster Name y Service Name
3. Haz clic en "Obtener Métricas"

### 4. Ver Logs

#### CloudWatch Logs

1. Ve a la pestaña "Logs"
2. Selecciona "CloudWatch Logs"
3. Ingresa el nombre del Log Group
4. Opcional: Define un rango de tiempo
5. Opcional: Aplica un patrón de filtro
6. Haz clic en "Buscar Logs"

#### CloudTrail

1. Ve a la pestaña "Logs"
2. Selecciona "CloudTrail"
3. Opcional: Filtra por nombre de evento
4. Opcional: Filtra por nombre de usuario
5. Define el rango de tiempo
6. Haz clic en "Buscar Eventos"

## API Endpoints

### Cuentas

```
GET /api/monitoring/aws/accounts
```

Retorna la lista de cuentas AWS configuradas (sin credenciales).

### Métricas

```
GET /api/monitoring/aws/metrics/ec2?account=ACCOUNT_NAME&instanceIds=i-xxx,i-yyy
GET /api/monitoring/aws/metrics/rds?account=ACCOUNT_NAME&dbInstanceIds=db-1,db-2
```

### Logs

```
GET /api/monitoring/aws/cloudwatch-logs?account=ACCOUNT_NAME&logGroup=/aws/lambda/my-function
GET /api/monitoring/aws/cloudtrail?account=ACCOUNT_NAME&startTime=2024-01-01T00:00:00Z&endTime=2024-01-02T00:00:00Z
```

## Arquitectura

```
src/
├── app/
│   ├── api/
│   │   └── monitoring/
│   │       └── aws/
│   │           ├── accounts/        # Lista de cuentas AWS
│   │           ├── metrics/
│   │           │   ├── ec2/        # Métricas EC2
│   │           │   └── rds/     # Métricas RDS
│   │           ├── cloudwatch-logs/ # CloudWatch Logs
│   │           └── cloudtrail/     # CloudTrail Events
│   └── monitoring/
│       ├── page.tsx                # Página principal
│       └── components/
│           ├── AWSMetricsView.tsx  # Vista de métricas
│           └── AWSLogsView.tsx     # Vista de logs
├── lib/
│   └── aws/
│       ├── aws-accounts.ts         # Gestión de cuentas
│       ├── cloudwatch-metrics.ts   # Cliente CloudWatch Metrics
│       ├── cloudwatch-logs.ts      # Cliente CloudWatch Logs
│       └── cloudtrail.ts           # Cliente CloudTrail
└── types/
    └── monitoring.ts               # Definiciones de tipos
```

## Troubleshooting

### Error: "No AWS accounts configured"

Verifica que las variables de entorno estén correctamente configuradas en tu archivo `.env`.

### Error: "Failed to fetch metrics"

1. Verifica que las credenciales AWS tengan los permisos necesarios
2. Verifica que el recurso (EC2, RDS, ECS) exista en la región especificada
3. Revisa los logs del servidor para más detalles

### Los logs no aparecen

1. Verifica que el Log Group existe en CloudWatch
2. Verifica que haya logs en el rango de tiempo especificado
3. Verifica que las credenciales tengan permisos de lectura en CloudWatch Logs

## Próximas Mejoras

- [ ] Soporte para más servicios de AWS (Lambda, DynamoDB, S3)
- [ ] Alertas y notificaciones
- [ ] Dashboards personalizados
- [ ] Exportación de métricas
- [ ] Comparación entre cuentas
- [ ] Métricas agregadas por tags
