# Configuración de Huawei Cloud

## 🔐 Obtener Credenciales de Huawei Cloud

### 1. Acceder a la Consola de IAM

1. Inicia sesión en [Huawei Cloud Console](https://console.huaweicloud.com/)
2. Ve a **IAM (Identity and Access Management)**
3. En el menú lateral, selecciona **Users**

### 2. Crear o Seleccionar un Usuario

Si no tienes un usuario IAM:

1. Click en **Create User**
2. Ingresa un nombre de usuario (ej: `mc-inventory-user`)
3. Selecciona **Programmatic access**
4. Click en **Next**

### 3. Obtener Access Key y Secret Key

1. Selecciona tu usuario
2. Ve a la pestaña **Access Keys**
3. Click en **Create Access Key**
4. **IMPORTANTE:** Descarga el archivo CSV o copia las credenciales inmediatamente
   - **Access Key ID (AK)**
   - **Secret Access Key (SK)**
5. Guarda estas credenciales de forma segura (no se pueden recuperar después)

### 4. Obtener Project ID

1. En la consola de Huawei Cloud, ve a **My Credentials** (esquina superior derecha)
2. En la sección **Projects**, encontrarás tu **Project ID**
3. Copia el Project ID de la región que estás usando (ej: Mexico City)

### 5. Verificar la Región

Las regiones disponibles de Huawei Cloud son:

| Código           | Ubicación           | Recomendado para      |
| ---------------- | ------------------- | --------------------- |
| `la-north-2`     | Mexico City, Mexico | Latinoamérica (Norte) |
| `la-south-2`     | Santiago, Chile     | Latinoamérica (Sur)   |
| `ap-southeast-1` | Bangkok, Thailand   | Asia Pacífico         |
| `ap-southeast-2` | Singapore           | Asia Pacífico         |
| `ap-southeast-3` | Hong Kong           | Asia Pacífico         |
| `cn-north-4`     | Beijing, China      | China                 |
| `cn-south-1`     | Guangzhou, China    | China                 |

**Para México, usa:** `la-north-2`

## 📝 Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env.local`:

```env
# Huawei Cloud Account 1
HUAWEI_ACCOUNT_1_NAME=mc_inventory
HUAWEI_ACCOUNT_1_ACCESS_KEY=tu_access_key_aqui
HUAWEI_ACCOUNT_1_SECRET_KEY=tu_secret_key_aqui
HUAWEI_ACCOUNT_1_PROJECT_ID=tu_project_id_aqui
HUAWEI_ACCOUNT_1_REGION=la-north-2
```

## 🔍 Verificar Credenciales

Para verificar que tus credenciales funcionan correctamente:

1. Reinicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

2. Abre la consola del navegador y busca errores relacionados con Huawei Cloud

3. Si ves errores de autenticación:
   - Verifica que el Access Key y Secret Key sean correctos
   - Verifica que el Project ID corresponda a la región correcta
   - Verifica que la región sea `la-north-2` para México

## 🛡️ Permisos Requeridos

Tu usuario IAM de Huawei Cloud necesita los siguientes permisos:

### Permisos Básicos

- **ECS FullAccess** - Para listar instancias EC2
- **CCE ReadOnlyAccess** - Para listar clusters de Kubernetes
- **RDS ReadOnlyAccess** - Para listar bases de datos RDS
- **DDS ReadOnlyAccess** - Para listar bases de datos DocumentDB
- **OBS ReadOnlyAccess** - Para listar buckets de Object Storage
- **LTS ReadOnlyAccess** - Para acceder a logs
- **BSS ReadOnlyAccess** - Para acceder a información de facturación

### Configurar Permisos

1. En la consola de IAM, selecciona tu usuario
2. Ve a la pestaña **Permissions**
3. Click en **Attach Policy**
4. Busca y selecciona las políticas mencionadas arriba
5. Click en **OK**

## 🐛 Solución de Problemas

### Error: "Huawei LTS Groups auth error"

**Causas posibles:**

1. Access Key o Secret Key incorrectos
2. Project ID incorrecto
3. Región incorrecta
4. Permisos insuficientes

**Soluciones:**

1. Verifica que las credenciales en `.env.local` sean correctas
2. Verifica que el Project ID corresponda a la región `la-north-2`
3. Verifica que el usuario tenga permisos de LTS ReadOnlyAccess
4. Regenera las credenciales si es necesario

### Error: "getaddrinfo ENOTFOUND lts.undefined.myhuaweicloud.com"

**Causa:** La variable `HUAWEI_ACCOUNT_1_REGION` no está definida

**Solución:** Agrega la región a tu `.env.local`:

```env
HUAWEI_ACCOUNT_1_REGION=la-north-2
```

### Error: "Request failed with status code 401"

**Causa:** Credenciales inválidas o expiradas

**Solución:**

1. Verifica que el Access Key y Secret Key sean correctos
2. Regenera las credenciales en la consola de Huawei Cloud
3. Actualiza el archivo `.env.local` con las nuevas credenciales

## 📚 Referencias

- [Huawei Cloud IAM Documentation](https://support.huaweicloud.com/intl/en-us/iam/index.html)
- [Huawei Cloud Regions](https://developer.huaweicloud.com/intl/en-us/endpoint)
- [Huawei Cloud API Authentication](https://support.huaweicloud.com/intl/en-us/api-iam/iam_30_0001.html)
