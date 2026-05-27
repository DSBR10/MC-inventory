import { huaweiRequest } from "./auth";

import {
  getHuaweiAccounts,
  type HuaweiAccount
} from "./accounts";

import { getHuaweiTags } from "./tags";

import {
  normalizeInventoryItem
} from "./normalize";

/**
 * Huawei CCE Inventory
 */
export async function getHuaweiCCEInventory() {

  const accounts =
    getHuaweiAccounts();

  const allInventory: any[] = [];

  for (const account of accounts) {

    const inventory =
      await getAccountCCEInventory(account);

    allInventory.push(...inventory);

  }

  return allInventory;

}

async function getAccountCCEInventory(
  account: HuaweiAccount
) {

  try {

    const host =
      `cce.${account.region}.myhuaweicloud.com`;

    const response =
      await huaweiRequest({

        method: "GET",

        host,

        uri:
          `/api/v3/projects/${account.projectId}/clusters`,

        ak:
          account.ak,

        sk:
          account.sk,

        projectId:
          account.projectId

      });

    if (!response) {

      return [];

    }

    const clusters =
      response.items || [];

    const inventory: any[] = [];

    for (const cluster of clusters) {

      try {

        const clusterId =
          cluster.metadata?.uid;

        const detailResponse =
          await huaweiRequest({

            method: "GET",

            host,

            uri:
              `/api/v3/projects/${account.projectId}/clusters/${clusterId}`,

            ak:
              account.ak,

            sk:
              account.sk,

            projectId:
              account.projectId

          });

        const clusterDetail =
          detailResponse || {};

        /* ───────────────────────────── */
        /* NODES */
        /* ───────────────────────────── */

        const children: any[] = [];

        try {

          const nodesResponse =
            await huaweiRequest({

              method: "GET",

              host,

              uri:
                `/api/v3/projects/${account.projectId}/clusters/${clusterId}/nodes`,

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId

            });

          const nodes =
            nodesResponse?.items || [];

          for (const node of nodes) {

            let nodeTags:
              Record<string, string> = {};

            /* ───────────────────────── */
            /* NODE TAGS */
            /* ───────────────────────── */

            try {

              nodeTags =
                await getHuaweiTags({

                  host,

                  uri:
                    `/api/v3/projects/${account.projectId}/clusters/${clusterId}/nodes/${node.metadata?.uid}/tags`,

                  ak:
                    account.ak,

                  sk:
                    account.sk,

                  projectId:
                    account.projectId

                });

            } catch {}

            children.push(

              normalizeInventoryItem({

                uniqueKey:
                  `HUAWEI-${account.projectId}-CCE-NODE-${node.metadata?.uid}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  account.projectId,

                service:
                  "CCE Node",

                resourceType:
                  "kubernetes-node",

                name:
                  node.metadata?.name || "N/A",

                id:
                  node.metadata?.uid || "N/A",

                host:
                  node.status?.privateIP || "N/A",

                privateIp:
                  node.status?.privateIP,

                publicIp:
                  node.status?.publicIP,

                status:
                  node.status?.phase || "UNKNOWN",

                operatingSystem:
                  node.spec?.os?.os || "Linux",

                platform:
                  node.spec?.flavor || "N/A",

                architecture:
                  node.spec?.az || "N/A",

                instanceType:
                  node.spec?.flavor || "N/A",

                availabilityZone:
                  node.spec?.az || account.region,

                publiclyExposed:
                  !!node.status?.publicIP,

                internetFacing:
                  !!node.status?.publicIP,

                topologyType:
                  "compute",

                tags:
                  nodeTags,

                raw:
                  node

              })

            );

          }

        } catch (err) {

          console.warn(
            `CCE NODE ERROR ${cluster.metadata?.name}:`,
            err
          );

        }

        /* ───────────────────────────── */
        /* CLUSTER TAGS */
        /* ───────────────────────────── */

        let tags:
          Record<string, string> = {};

        // 1. Intentar tags directos metadata
        if (cluster.metadata?.tags) {

          for (const tag of cluster.metadata.tags) {

            if (
              typeof tag === "string" &&
              tag.includes("=")
            ) {

              const [key, ...rest] =
                tag.split("=");

              tags[key] =
                rest.join("=");

            } else if (
              tag.key &&
              tag.value
            ) {

              tags[tag.key] =
                tag.value;

            }

          }

        }

        // 2. Intentar via TMS
        if (Object.keys(tags).length === 0) {

          try {

            const tmsHost =
              `tms.${account.region}.myhuaweicloud.com`;

            const resourceTypes = [

              "cce",
              "cce-cluster",
              "clusters",
              "cluster"

            ];

            for (const resourceType of resourceTypes) {

              try {

                const tmsData =
                  await huaweiRequest({

                    method: "POST",

                    host:
                      tmsHost,

                    uri:
                      `/v1.0/resource_tags/action`,

                    ak:
                      account.ak,

                    sk:
                      account.sk,

                    projectId:
                      account.projectId,

                    body: {

                      action:
                        "filter",

                      limit:
                        "100",

                      matches: [

                        {
                          key:
                            "resource_id",

                          value:
                            clusterId
                        }

                      ],

                      tags: [],

                      resource_type:
                        resourceType

                    }

                  });

                const resources =
                  tmsData?.resources || [];

                for (const resource of resources) {

                  for (const tag of (resource.tags || [])) {

                    if (
                      tag.key &&
                      tag.value
                    ) {

                      tags[tag.key] =
                        tag.value;

                    }

                  }

                }

                if (
                  Object.keys(tags).length > 0
                ) {

                  break;

                }

              } catch {}

            }

          } catch {}

        }

        // 3. Fallback final
        if (Object.keys(tags).length === 0) {

          try {

            tags =
              await getHuaweiTags({

                host,

                uri:
                  `/api/v3/projects/${account.projectId}/clusters/${clusterId}/tags`,

                ak:
                  account.ak,

                sk:
                  account.sk,

                projectId:
                  account.projectId

              });

          } catch {}

        }

        /* ───────────────────────────── */
        /* INVENTORY */
        /* ───────────────────────────── */

        inventory.push(

          normalizeInventoryItem({

            uniqueKey:
              `HUAWEI-${account.projectId}-CCE-${clusterId}`,

            provider:
              "HUAWEI CLOUD",

            accountName:
              account.name,

            accountId:
              account.projectId,

            service:
              "CCE",

            resourceType:
              "kubernetes-cluster",

            name:
              cluster.metadata?.name || "N/A",

            id:
              clusterId || "N/A",

            host:
              clusterDetail?.status?.endpoints?.[0]?.url || "N/A",

            status:
              cluster.status?.phase || "UNKNOWN",

            operatingSystem:
              clusterDetail?.spec?.containerNetwork?.mode || "vpc-router",

            platform:
              clusterDetail?.spec?.type || "VirtualMachine",

            architecture:
              clusterDetail?.spec?.version || "N/A",

            instanceType:
              clusterDetail?.spec?.flavor || "N/A",

            availabilityZone:
              account.region,

            topologyType:
              "cluster",

            children,

            tags,

            raw:
              clusterDetail

          })

        );

      } catch (err) {

        console.error(
          `CCE DETAIL ERROR ${cluster.metadata?.name}:`,
          err
        );

      }

    }

    return inventory;

  } catch (error: any) {

    console.error(
      "HUAWEI CCE ERROR:",
      error.message
    );

    return [];

  }

}