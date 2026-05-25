// Huawei Cloud CCE (Cloud Container Engine) Service
import { getHuaweiAccounts, type HuaweiAccount } from "./accounts";
import axios from "axios";

const region = process.env.HUAWEI_REGION || "la-south-2";

/**
 * Obtiene el inventario de clusters CCE de Huawei Cloud
 */
export async function getHuaweiCCEInventory() {
  const accounts = getHuaweiAccounts();
  const allInventory: any[] = [];

  for (const account of accounts) {
    const inventory = await getAccountCCEInventory(account);
    allInventory.push(...inventory);
  }

  return allInventory;
}

async function getAccountCCEInventory(account: HuaweiAccount) {
  try {
    const crypto = require("crypto");

    const endpoint = `https://cce.${region}.myhuaweicloud.com`;
    const path = `/api/v3/projects/${account.projectId}/clusters`;

    // Crear firma de autenticación Huawei Cloud
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
      Authorization: signature,
    };

    // Obtener lista de clusters
    const clustersResponse = await axios.get(`${endpoint}${path}`, { headers });
    const clusters = clustersResponse.data.items || [];

    const inventory: any[] = [];

    for (const cluster of clusters) {
      try {
        // Obtener detalles del cluster
        const detailPath = `/api/v3/projects/${account.projectId}/clusters/${cluster.metadata.uid}`;
        const detailResponse = await axios.get(`${endpoint}${detailPath}`, {
          headers,
        });
        const clusterDetail = detailResponse.data;

        // Obtener nodos del cluster
        const nodesPath = `/api/v3/projects/${account.projectId}/clusters/${cluster.metadata.uid}/nodes`;
        let nodes = [];
        try {
          const nodesResponse = await axios.get(`${endpoint}${nodesPath}`, {
            headers,
          });
          nodes = nodesResponse.data.items || [];
        } catch (err) {
          console.warn(
            `No se pudieron obtener nodos del cluster ${cluster.metadata.name}`,
          );
        }

        inventory.push({
          uniqueKey: `HUAWEI-${account.projectId}-CCE-${cluster.metadata.uid}`,
          provider: "Huawei",
          accountName: account.name,
          accountId: account.projectId,
          service: "CCE",
          name: cluster.metadata.name || "N/A",
          id: cluster.metadata.uid || "N/A",
          host: clusterDetail.status?.endpoints?.[0]?.url || "N/A",
          status: cluster.status.phase || "UNKNOWN",
          operatingSystem:
            clusterDetail.spec.containerNetwork?.mode || "vpc-router",
          platform: clusterDetail.spec.type || "VirtualMachine",
          architecture: clusterDetail.spec.version || "N/A",
          instanceType: clusterDetail.spec.flavor || "N/A",
          availabilityZone: region,
          tags: cluster.metadata.labels || {},
          raw: {
            uid: cluster.metadata.uid,
            description: cluster.spec.description,
            billingMode: clusterDetail.spec.billingMode,
            clusterType: clusterDetail.spec.type,
            flavor: clusterDetail.spec.flavor,
            version: clusterDetail.spec.version,
            containerNetwork: clusterDetail.spec.containerNetwork,
            hostNetwork: clusterDetail.spec.hostNetwork,
            serviceNetwork: clusterDetail.spec.serviceNetwork,
            endpoints: clusterDetail.status?.endpoints,
            nodesCount: nodes.length,
            nodes: nodes.map((node: any) => ({
              name: node.metadata.name,
              status: node.status.phase,
              privateIP: node.status.privateIP,
              publicIP: node.status.publicIP,
              flavor: node.spec.flavor,
              az: node.spec.az,
            })),
          },
        });
      } catch (err) {
        console.error(
          `Error al obtener detalles del cluster ${cluster.metadata.name}:`,
          err,
        );
      }
    }

    return inventory;
  } catch (error: any) {
    console.error("Error al obtener inventario de CCE:", error.message);
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

  const canonicalRequest = `${method}\n${path}\n\ncontent-type:application/json\nhost:cce.la-south-2.myhuaweicloud.com\nx-sdk-date:${timestamp}\n\ncontent-type;host;x-sdk-date\n${crypto
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
