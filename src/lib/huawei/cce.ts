// Huawei Cloud CCE (Cloud Container Engine) Service
import { huaweiRequest } from "./auth";
import { getHuaweiAccounts, type HuaweiAccount } from "./accounts";
import { getHuaweiTags } from "./tags";

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
    const host = `cce.${account.region}.myhuaweicloud.com`;

    // Obtener lista de clusters
    const data = await huaweiRequest({
      method: "GET",
      host,
      uri: `/api/v3/projects/${account.projectId}/clusters`,
      ak: account.ak,
      sk: account.sk,
      projectId: account.projectId,
    });

    if (!data) {
      return [];
    }

    const clusters = data.items || [];

    const inventory: any[] = [];

    for (const cluster of clusters) {
      try {
        // Obtener detalles del cluster
        const clusterDetail = await huaweiRequest({
          method: "GET",
          host,
          uri: `/api/v3/projects/${account.projectId}/clusters/${cluster.metadata.uid}`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
        });

        // Obtener nodos del cluster como children
        const children: any[] = [];
        try {
          const nodesData = await huaweiRequest({
            method: "GET",
            host,
            uri: `/api/v3/projects/${account.projectId}/clusters/${cluster.metadata.uid}/nodes`,
            ak: account.ak,
            sk: account.sk,
            projectId: account.projectId,
          });
          const nodes = nodesData?.items || [];

          for (const node of nodes) {
            let nodeTags: Record<string, string> = {};
            try {
              nodeTags = await getHuaweiTags({
                host,
                uri: `/api/v3/projects/${account.projectId}/clusters/${cluster.metadata.uid}/nodes/${node.metadata?.uid}/tags`,
                ak: account.ak,
                sk: account.sk,
                projectId: account.projectId,
              });
            } catch {}

            children.push({
              uniqueKey: `HUAWEI-${account.projectId}-CCE-NODE-${node.metadata?.uid}`,
              provider: "HUAWEI CLOUD",
              accountName: account.name,
              accountId: account.projectId,
              service: "CCE Node",
              resourceType: "node",
              name: node.metadata?.name || "N/A",
              id: node.metadata?.uid || "N/A",
              host: node.status?.privateIP || "N/A",
              privateIp: node.status?.privateIP,
              publicIp: node.status?.publicIP,
              status: node.status?.phase || "UNKNOWN",
              operatingSystem: node.spec?.os?.os || "N/A",
              platform: node.spec?.flavor || "N/A",
              architecture: node.spec?.az || "N/A",
              instanceType: node.spec?.flavor || "N/A",
              availabilityZone: node.spec?.az || account.region,
              tags: nodeTags,
              raw: {
                uid: node.metadata?.uid,
                name: node.metadata?.name,
                status: node.status?.phase,
                privateIP: node.status?.privateIP,
                publicIP: node.status?.publicIP,
                flavor: node.spec?.flavor,
                az: node.spec?.az,
                os: node.spec?.os,
              },
            });
          }
        } catch (err) {
          console.warn(
            `No se pudieron obtener nodos del cluster ${cluster.metadata.name}`,
          );
        }

        // Obtener tags via TMS (Tag Management Service) API
        // Resource tags in Huawei Cloud are managed by TMS, not the service-specific API
        let tags: Record<string, string> = {};
        try {
          const tmsHost = `tms.${account.region}.myhuaweicloud.com`;
          const tmsData = await huaweiRequest({
            method: "POST",
            host: tmsHost,
            uri: `/v1.0/resource_tags/action`,
            ak: account.ak,
            sk: account.sk,
            projectId: account.projectId,
            body: {
              action: "query",
              resources: [{
                resource_id: cluster.metadata.uid,
                resource_type: "cce-cluster",
                project_id: account.projectId,
              }],
            },
          });

          if (tmsData?.tags) {
            for (const tag of tmsData.tags) {
              if (tag.key && tag.value) {
                tags[tag.key] = tag.value;
              } else if (typeof tag === "string" && tag.includes("=")) {
                const [key, ...rest] = tag.split("=");
                tags[key] = rest.join("=");
              }
            }
          }
        } catch {}

        // Fallback: try CCE tags API
        if (Object.keys(tags).length === 0) {
          try {
            tags = await getHuaweiTags({
              host,
              uri: `/api/v3/projects/${account.projectId}/clusters/${cluster.metadata.uid}/tags`,
              ak: account.ak,
              sk: account.sk,
              projectId: account.projectId,
            });
          } catch {}
        }

        inventory.push({
          uniqueKey: `HUAWEI-${account.projectId}-CCE-${cluster.metadata.uid}`,
          provider: "HUAWEI CLOUD",
          accountName: account.name,
          accountId: account.projectId,
          service: "CCE",
          name: cluster.metadata.name || "N/A",
          id: cluster.metadata.uid || "N/A",
          host: clusterDetail?.status?.endpoints?.[0]?.url || "N/A",
          status: cluster.status?.phase || "UNKNOWN",
          operatingSystem:
            clusterDetail?.spec?.containerNetwork?.mode || "vpc-router",
          platform: clusterDetail?.spec?.type || "VirtualMachine",
          architecture: clusterDetail?.spec?.version || "N/A",
          instanceType: clusterDetail?.spec?.flavor || "N/A",
          availabilityZone: account.region,
          tags,
          children,
          raw: {
            uid: cluster.metadata.uid,
            description: cluster.spec?.description,
            billingMode: clusterDetail?.spec?.billingMode,
            clusterType: clusterDetail?.spec?.type,
            flavor: clusterDetail?.spec?.flavor,
            version: clusterDetail?.spec?.version,
            containerNetwork: clusterDetail?.spec?.containerNetwork,
            hostNetwork: clusterDetail?.spec?.hostNetwork,
            serviceNetwork: clusterDetail?.spec?.serviceNetwork,
            endpoints: clusterDetail?.status?.endpoints,
            nodesCount: children.length,
          },
        });
      } catch (err) {
        console.error(
          `Error al obtener detalles del cluster ${cluster.metadata?.name}:`,
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