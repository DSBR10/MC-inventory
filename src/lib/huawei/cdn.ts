// Huawei Cloud CDN (Content Delivery Network) Service
import { huaweiRequest } from "./auth";
import { getHuaweiAccounts, type HuaweiAccount } from "./accounts";
import { getHuaweiTags } from "./tags";

/**
 * Obtiene el inventario de dominios CDN de Huawei Cloud
 */
export async function getHuaweiCDNInventory() {
  const accounts = getHuaweiAccounts();
  const allInventory: any[] = [];

  for (const account of accounts) {
    const inventory = await getAccountCDNInventory(account);
    allInventory.push(...inventory);
  }

  return allInventory;
}

async function getAccountCDNInventory(account: HuaweiAccount) {
  try {
    const host = "cdn.myhuaweicloud.com";

    // Obtener lista de dominios CDN
    const data = await huaweiRequest({
      method: "GET",
      host,
      uri: "/v1.0/cdn/domains",
      ak: account.ak,
      sk: account.sk,
      projectId: account.projectId,
    });

    if (!data) {
      return [];
    }

    const domains = data.domains || [];

    const inventory: any[] = [];

    for (const domain of domains) {
      try {
        // Obtener detalles del dominio
        const detailData = await huaweiRequest({
          method: "GET",
          host,
          uri: `/v1.0/cdn/domains/${domain.id}`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
        });

        const domainDetail = detailData?.domain || {};

        // Obtener configuración del dominio
        let config = {};
        try {
          const configData = await huaweiRequest({
            method: "GET",
            host,
            uri: `/v1.0/cdn/domains/${domain.id}/configs`,
            ak: account.ak,
            sk: account.sk,
            projectId: account.projectId,
          });
          config = configData?.configs || {};
        } catch (err) {
          console.warn(
            `No se pudo obtener configuración del dominio ${domain.domain_name}`,
          );
        }

        // Obtener tags
        const tags = await getHuaweiTags({
          host,
          uri: `/v1.0/cdn/domains/${domain.id}/tags`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
        });

        inventory.push({
          uniqueKey: `HUAWEI-${account.projectId}-CDN-${domain.id}`,
          provider: "HUAWEI CLOUD",
          accountName: account.name,
          accountId: account.projectId,
          service: "CDN",
          name: domain.domain_name || "N/A",
          id: domain.id || "N/A",
          host: domain.cname || "N/A",
          status: domain.domain_status || "UNKNOWN",
          operatingSystem:
            domainDetail.service_area || "outside_mainland_china",
          platform: domainDetail.business_type || "web",
          architecture: domainDetail.sources?.[0]?.origin_type || "ipaddr",
          instanceType: domainDetail.domain_type || "acceleration",
          availabilityZone: "Global",
          tags,
          raw: {
            id: domain.id,
            cname: domain.cname,
            businessType: domainDetail.business_type,
            serviceArea: domainDetail.service_area,
            sources: domainDetail.sources,
            httpsStatus: domainDetail.https_status,
            createTime: domainDetail.create_time,
            modifyTime: domainDetail.modify_time,
            disabled: domainDetail.disabled,
            locked: domainDetail.locked,
            rangeStatus: domainDetail.range_status,
            followStatus: domainDetail.follow_status,
            originProtocol: domainDetail.origin_protocol,
            forceRedirect: domainDetail.force_redirect,
            configs: config,
          },
        });
      } catch (err) {
        console.error(
          `Error al obtener detalles del dominio CDN ${domain.domain_name}:`,
          err,
        );
      }
    }

    return inventory;
  } catch (error: any) {
    console.error("Error al obtener inventario de CDN:", error.message);
    return [];
  }
}