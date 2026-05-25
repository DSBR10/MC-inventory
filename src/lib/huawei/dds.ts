// Huawei Cloud DDS (Document Database Service) - MongoDB Compatible
import { getHuaweiAccounts, type HuaweiAccount } from "./accounts";
import axios from "axios";

const region = process.env.HUAWEI_REGION || "la-south-2";

/**
 * Obtiene el inventario de instancias DDS (Document Database) de Huawei Cloud
 */
export async function getHuaweiDDSInventory() {
  const accounts = getHuaweiAccounts();
  const allInventory: any[] = [];

  for (const account of accounts) {
    const inventory = await getAccountDDSInventory(account);
    allInventory.push(...inventory);
  }

  return allInventory;
}

async function getAccountDDSInventory(account: HuaweiAccount) {
  try {
    const crypto = require("crypto");

    const endpoint = `https://dds.${region}.myhuaweicloud.com`;
    const path = `/v3/${account.projectId}/instances`;

    // Crear firma de autenticación
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const signature = createHuaweiSignature(
      account.ak,
      account.sk,
      "GET",
      path,
      timestamp,
      region,
    );

    const headers = {
      "Content-Type": "application/json",
      "X-Sdk-Date": timestamp,
      "X-Project-Id": account.projectId,
      Authorization: signature,
    };

    // Obtener lista de instancias DDS
    const instancesResponse = await axios.get(`${endpoint}${path}`, {
      headers,
    });
    const instances = instancesResponse.data.instances || [];

    const inventory: any[] = [];

    for (const instance of instances) {
      try {
        // Obtener detalles de la instancia
        const detailPath = `/v3/${account.projectId}/instances/${instance.id}`;
        const detailResponse = await axios.get(`${endpoint}${detailPath}`, {
          headers,
        });
        const instanceDetail = detailResponse.data.instance;

        // Obtener backups
        const backupsPath = `/v3/${account.projectId}/backups?instance_id=${instance.id}`;
        let backups = [];
        try {
          const backupsResponse = await axios.get(`${endpoint}${backupsPath}`, {
            headers,
          });
          backups = backupsResponse.data.backups || [];
        } catch (err) {
          console.warn(
            `No se pudieron obtener backups de la instancia ${instance.name}`,
          );
        }

        // Obtener métricas de la instancia
        const metricsPath = `/v3/${account.projectId}/instances/${instance.id}/metrics`;
        let metrics = {};
        try {
          const metricsResponse = await axios.get(`${endpoint}${metricsPath}`, {
            headers,
          });
          metrics = metricsResponse.data || {};
        } catch (err) {
          console.warn(
            `No se pudieron obtener métricas de la instancia ${instance.name}`,
          );
        }

        inventory.push({
          uniqueKey: `HUAWEI-${account.projectId}-DDS-${instance.id}`,
          provider: "Huawei",
          accountName: account.name,
          accountId: account.projectId,
          service: "DDS",
          name: instance.name || "N/A",
          id: instance.id || "N/A",
          host:
            instanceDetail.private_ips?.[0] ||
            instanceDetail.public_ip ||
            "N/A",
          status: instance.status || "UNKNOWN",
          operatingSystem: instanceDetail.engine || "mongodb",
          platform: instanceDetail.engine_version || "N/A",
          architecture: instanceDetail.mode || "ReplicaSet",
          instanceType: instanceDetail.flavor?.spec_code || "N/A",
          availabilityZone:
            instanceDetail.availability_zone || region,
          tags: instanceDetail.tags || {},
          raw: {
            id: instance.id,
            region: instanceDetail.region,
            mode: instanceDetail.mode,
            engine: instanceDetail.engine,
            engineVersion: instanceDetail.engine_version,
            dbPort: instanceDetail.port,
            vpcId: instanceDetail.vpc_id,
            subnetId: instanceDetail.subnet_id,
            securityGroupId: instanceDetail.security_group_id,
            diskEncryptionId: instanceDetail.disk_encryption_id,
            sslOption: instanceDetail.ssl_option,
            backupStrategy: instanceDetail.backup_strategy,
            maintenanceWindow: instanceDetail.maintenance_window,
            groups: instanceDetail.groups?.map((group: any) => ({
              type: group.type,
              name: group.name,
              status: group.status,
              volume: group.volume,
              nodes: group.nodes?.map((node: any) => ({
                id: node.id,
                name: node.name,
                status: node.status,
                role: node.role,
                privateIp: node.private_ip,
                publicIp: node.public_ip,
                specCode: node.spec_code,
                availabilityZone: node.availability_zone,
              })),
            })),
            timeZone: instanceDetail.time_zone,
            actions: instanceDetail.actions,
            enterpriseProjectId: instanceDetail.enterprise_project_id,
            datastore: instanceDetail.datastore,
            diskType: instanceDetail.disk_type,
            payMode: instanceDetail.pay_mode,
            createTime: instance.created,
            updateTime: instance.updated,
            backupsCount: backups.length,
            latestBackup: backups[0]?.end_time,
            metrics: metrics,
          },
        });
      } catch (err) {
        console.error(
          `Error al obtener detalles de la instancia DDS ${instance.name}:`,
          err,
        );
      }
    }

    return inventory;
  } catch (error: any) {
    console.error("Error al obtener inventario de DDS:", error.message);
    return [];
  }
}

/**
 * Crea la firma de autenticación para Huawei Cloud API
 */
function createHuaweiSignature(
  accessKey: string,
  secretKey: string,
  method: string,
  path: string,
  timestamp: string,
  region: string,
): string {
  const crypto = require("crypto");

  const host = `dds.${region}.myhuaweicloud.com`;

  const canonicalRequest = `${method}\n${path}\n\ncontent-type:application/json\nhost:${host}\nx-sdk-date:${timestamp}\n\ncontent-type;host;x-sdk-date\n${crypto
    .createHash("sha256")
    .update("")
    .digest("hex")}`;

  const stringToSign = `SDK-HMAC-SHA256\n${timestamp}\n${crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex")}`;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(stringToSign)
    .digest("hex");

  return `SDK-HMAC-SHA256 Access=${accessKey}, SignedHeaders=content-type;host;x-sdk-date, Signature=${signature}`;
}
