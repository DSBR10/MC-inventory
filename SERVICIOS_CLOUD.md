# Servicios Cloud Integrados - MC Inventory

## 📋 Resumen de Servicios Implementados

### AWS Services ✅

- **EC2** - Instancias de computación
- **RDS** - Bases de datos relacionales
- **S3** - Almacenamiento de objetos
- **VPC** - Redes virtuales
- **Subnet** - Subredes
- **ELB** - Balanceadores de carga
- **ECS** - Contenedores (Elastic Container Service) ✨ NUEVO
- **CloudFront** - CDN (Content Delivery Network) ✨ NUEVO
- **DynamoDB** - Base de datos NoSQL ✨ NUEVO
- **DocumentDB** - Base de datos compatible con MongoDB ✨ NUEVO
- **Lambda** - Funciones serverless
- **EKS** - Kubernetes administrado
- **ElastiCache** - Caché en memoria (Redis/Memcached)
- **API Gateway** - Gestión de APIs

### Huawei Cloud Services ✅

- **ECS** - Elastic Cloud Server
- **RDS** - Relational Database Service
- **VPC** - Virtual Private Cloud
- **Subnet** - Subredes
- **OBS** - Object Storage Service
- **ELB** - Elastic Load Balancer
- **CCE** - Cloud Container Engine (Kubernetes) ✨ NUEVO
- **CDN** - Content Delivery Network ✨ NUEVO
- **DDS** - Document Database Service (MongoDB) ✨ NUEVO

---

## 🔧 Configuración de Variables de Entorno

### AWS Configuration

Crea o actualiza tu archivo `.env.local`:

```bash
# AWS Region
AWS_REGION=us-east-1

# AWS Accounts (puedes agregar múltiples cuentas)
AWS_ACCOUNT_1_NAME=Production
AWS_ACCOUNT_1_ID=123456789012
AWS_ACCOUNT_1_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_ACCOUNT_1_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

AWS_ACCOUNT_2_NAME=Development
AWS_ACCOUNT_2_ID=987654321098
AWS_ACCOUNT_2_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE2
AWS_ACCOUNT_2_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY2

# Habilitar tags en RDS/DocumentDB (puede ser lento)
ENABLE_RDS_TAGS=false
```

### Huawei Cloud Configuration

```bash
# Huawei Cloud Region
HUAWEI_REGION=la-south-2

# Huawei Cloud Accounts (puedes agregar múltiples cuentas)
HUAWEI_ACCOUNT_1_NAME=Production
HUAWEI_ACCOUNT_1_PROJECT_ID=0123456789abcdef0123456789abcdef
HUAWEI_ACCOUNT_1_AK=ABCDEFGHIJKLMNOPQRST
HUAWEI_ACCOUNT_1_SK=1234567890abcdefghijklmnopqrstuvwxyz1234

HUAWEI_ACCOUNT_2_NAME=Development
HUAWEI_ACCOUNT_2_PROJECT_ID=fedcba9876543210fedcba9876543210
HUAWEI_ACCOUNT_2_AK=ZYXWVUTSRQPONMLKJIHG
HUAWEI_ACCOUNT_2_SK=zyxwvutsrqponmlkjihgfedcba0987654321
```

---

## 📦 Instalación de Dependencias

Ejecuta el siguiente comando para instalar las nuevas dependencias de AWS SDK:

```bash
npm install
```

Las siguientes dependencias se han agregado:

- `@aws-sdk/client-api-gateway`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/client-eks`
- `@aws-sdk/client-elasticache`
- `@aws-sdk/client-lambda`

---

## 🚀 Uso del Sistema

### 1. Iniciar el servidor de desarrollo

```bash
npm run dev
```

### 2. Acceder al inventario

Abre tu navegador en: `http://localhost:3000`

### 3. Ver el inventario completo

El sistema automáticamente cargará todos los servicios de AWS y Huawei Cloud configurados.

---

## 📊 Servicios Nuevos - Detalles

### AWS ECS (Elastic Container Service)

- **Clusters**: Lista todos los clusters ECS
- **Services**: Servicios corriendo en cada cluster
- **Task Definitions**: Definiciones de tareas activas
- **Información incluida**:
  - Conteo de tareas (deseadas, corriendo, pendientes)
  - Tipo de lanzamiento (Fargate/EC2)
  - Versión de plataforma
  - ARN de definición de tarea

### AWS CloudFront

- **Distribuciones**: Todas las distribuciones CDN
- **Información incluida**:
  - Nombre de dominio
  - Aliases (CNAMEs)
  - Orígenes configurados
  - Comportamiento de caché
  - Certificados SSL/TLS
  - Restricciones geográficas
  - WAF ACL asociado

### AWS DynamoDB

- **Tablas**: Todas las tablas DynamoDB
- **Información incluida**:
  - Claves primarias (partition key y sort key)
  - Índices secundarios globales (GSI)
  - Índices secundarios locales (LSI)
  - Modo de facturación (On-Demand/Provisioned)
  - TTL habilitado
  - Point-in-Time Recovery
  - Encriptación
  - Tamaño y conteo de items

### AWS DocumentDB

- **Clusters**: Clusters de DocumentDB
- **Instancias**: Instancias individuales
- **Información incluida**:
  - Endpoints (writer y reader)
  - Versión del motor
  - Multi-AZ
  - Encriptación
  - Ventanas de mantenimiento
  - Configuración de backups
  - Grupos de seguridad

### Huawei CCE (Cloud Container Engine)

- **Clusters**: Clusters de Kubernetes
- **Nodos**: Nodos de cada cluster
- **Información incluida**:
  - Versión de Kubernetes
  - Tipo de cluster (VirtualMachine/BareMetal)
  - Configuración de red (VPC, Container, Service)
  - Endpoints de API
  - Estado de nodos
  - IPs públicas y privadas

### Huawei CDN

- **Dominios**: Dominios CDN configurados
- **Información incluida**:
  - CNAME
  - Tipo de negocio (web, download, video)
  - Área de servicio
  - Orígenes configurados
  - Estado HTTPS
  - Configuraciones de caché
  - Estadísticas de uso

### Huawei DDS (Document Database Service)

- **Instancias**: Instancias MongoDB compatibles
- **Información incluida**:
  - Modo (ReplicaSet, Sharding, Single)
  - Versión de MongoDB
  - Grupos de nodos
  - Configuración de backup
  - Encriptación de disco
  - SSL habilitado
  - Ventana de mantenimiento
  - Métricas de rendimiento

---

## 🔍 Filtros y Búsqueda

El inventario permite filtrar por:

- **Provider**: AWS o Huawei
- **Service**: Tipo de servicio (EC2, ECS, DynamoDB, CCE, etc.)
- **Status**: Estado del recurso
- **Account**: Cuenta específica
- **Tags**: Etiquetas personalizadas

---

## 📈 Caché y Rendimiento

- **TTL de caché**: 10 minutos (configurable en `src/app/api/inventory/route.ts`)
- **Refresh automático**: El sistema refresca el inventario en segundo plano
- **Carga paralela**: Todos los servicios se cargan en paralelo para máxima velocidad

---

## 🛠️ Troubleshooting

### Error: "No se pueden obtener recursos de AWS"

- Verifica que las credenciales AWS estén correctas
- Asegúrate de que el usuario IAM tenga los permisos necesarios
- Revisa que la región esté correctamente configurada

### Error: "No se pueden obtener recursos de Huawei"

- Verifica las credenciales AK/SK
- Asegúrate de que el Project ID sea correcto
- Revisa que la región esté disponible

### Permisos IAM necesarios para AWS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:List*",
        "s3:GetBucket*",
        "ecs:Describe*",
        "ecs:List*",
        "cloudfront:List*",
        "cloudfront:Get*",
        "dynamodb:List*",
        "dynamodb:Describe*",
        "lambda:List*",
        "lambda:Get*",
        "eks:List*",
        "eks:Describe*",
        "elasticache:Describe*",
        "apigateway:GET"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 📝 Notas Importantes

1. **CloudFront es global**: No depende de la región configurada
2. **DocumentDB usa el cliente RDS**: Es compatible con la API de RDS
3. **DynamoDB TTL**: Puede tardar hasta 48 horas en eliminar items expirados
4. **Huawei CCE**: Requiere permisos de CCE y VPC
5. **Caché local**: Los datos se guardan en `data/inventory-cache.json`

---

## 🎯 Próximos Pasos

Para agregar más servicios:

1. Crea un nuevo archivo en `src/lib/aws/` o `src/lib/huawei/`
2. Implementa la función `get[Provider][Service]Inventory()`
3. Agrega la importación en `src/lib/aws/index.ts` o `src/app/api/inventory/route.ts`
4. Actualiza el `package.json` si necesitas nuevas dependencias

---

## 📞 Soporte

Si tienes problemas o preguntas, revisa:

- Los logs de la consola del navegador
- Los logs del servidor Next.js
- El archivo de caché en `data/inventory-cache.json`
