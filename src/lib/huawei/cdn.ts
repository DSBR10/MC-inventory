// Huawei Cloud CDN (Content Delivery Network) Service
import { getHuaweiAccounts, type HuaweiAccount } from "./accounts";
import axios from "axios";

const region = process.env.HUAWEI_REGION || "la-south-2";

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
    const crypto = require("crypto");

    const endpoint = `https://cdn.myhuaweicloud.com`;
    const path = `/v1.0/cdn/domains`;

    // Crear firma de autenticación
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const signature = createHuaweiSignature(
      account.ak,
      account.sk,
      "GET",
      path,
      timestamp,
    );

    const headers = {
      "Content-Type": "application/json",
      "X-Sdk-Date": timestamp,
      "X-Project-Id": account.projectId,
      Authorization: signature,
    };

    // Obtener lista de dominios CDN
    const domainsResponse = await axios.get(`${endpoint}${path}`, { headers });
    const domains = domainsResponse.data.domains || [];

    const inventory: any[] = [];

    for (const domain of domains) {
      try {
        // Obtener detalles del dominio
        const detailPath = `/v1.0/cdn/domains/${domain.id}`;
        const detailResponse = await axios.get(`${endpoint}${detailPath}`, {
          headers,
        });
        const domainDetail = detailResponse.data.domain;

        // Obtener configuración del dominio
        const configPath = `/v1.0/cdn/domains/${domain.id}/configs`;
        let config = {};
        try {
          const configResponse = await axios.get(`${endpoint}${configPath}`, {
            headers,
          });
          config = configResponse.data.configs || {};
        } catch (err) {
          console.warn(
            `No se pudo obtener configuración del dominio ${domain.domain_name}`,
          );
        }

        // Obtener estadísticas
        const statsPath = `/v1.0/cdn/statistics/domain-summary?domain_name=${domain.domain_name}`;
        let stats = {};
        try {
          const statsResponse = await axios.get(`${endpoint}${statsPath}`, {
            headers,
          });
          stats = statsResponse.data || {};
        } catch (err) {
          console.warn(
            `No se pudieron obtener estadísticas del dominio ${domain.domain_name}`,
          );
        }

        inventory.push({
          uniqueKey: `HUAWEI-${account.projectId}-CDN-${domain.id}`,
          provider: "Huawei",
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
          tags: domainDetail.tags || {},
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
            stats: stats,
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

/**
 * Crea la firma de autenticación para Huawei Cloud API
 */
function createHuaweiSignature(
  accessKey: string,
  secretKey: string,
  method: string,
  path: string,
  timestamp: string,
): string {
  const crypto = require("crypto");

  const canonicalRequest = `${method}\n${path}\n\ncontent-type:application/json\nhost:cdn.myhuaweicloud.com\nx-sdk-date:${timestamp}\n\ncontent-type;host;x-sdk-date\n${crypto
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
