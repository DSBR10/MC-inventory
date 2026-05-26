// Huawei Cloud DDS (Document Database Service) - MongoDB Compatible
import { huaweiRequest } from "./auth";
import { getHuaweiAccounts, type HuaweiAccount } from "./accounts";
import { getHuaweiTags } from "./tags";

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
    const host = `dds.${account.region}.myhuaweicloud.com`;

    // Obtener lista de instancias DDS
    const data = await huaweiRequest({
      method: "GET",
      host,
      uri: `/v3/${account.projectId}/instances`,
      ak: account.ak,
      sk: account.sk,
      projectId: account.projectId,
    });

    if (!data) {
      return [];
    }

    const instances = data.instances || [];

    const inventory: any[] = [];

    for (const instance of instances) {
      try {
        // Obtener detalles de la instancia
        const detailData = await huaweiRequest({
          method: "GET",
          host,
          uri: `/v3/${account.projectId}/instances/${instance.id}`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
        });

        const instanceDetail = detailData?.instance || {};

        // Obtener tags
        const tags = await getHuaweiTags({
          host,
          uri: `/v3/${account.projectId}/instances/${instance.id}/tags`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
        });

        inventory.push({
          uniqueKey: `HUAWEI-${account.projectId}-DDS-${instance.id}`,
          provider: "HUAWEI CLOUD",
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
            instanceDetail.availability_zone || account.region,
          tags,
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