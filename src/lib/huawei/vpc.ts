import {
  huaweiRequest
} from "./auth";

import {
  getHuaweiAccounts
} from "@/lib/huawei/accounts";

import {
  getHuaweiTags
} from "./tags";

import {
  normalizeInventoryItem
} from "./normalize";

export async function getHuaweiVPCInventory() {

  try {

    const accounts =
      getHuaweiAccounts();

    const inventory =
      await Promise.all(

        accounts.map(async (account) => {

          const response =
            await huaweiRequest({

              method: "GET",

              host:
                `vpc.${account.region}.myhuaweicloud.com`,

              uri:
                `/v1/${account.projectId}/vpcs`,

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId

            });

          if (
            !response ||
            response.status >= 400
          ) {

            return [];

          }

          const vpcs =
            response.data?.vpcs || [];

          return await Promise.all(

            vpcs.map(async (vpc: any) => {

              const tenantId =
                vpc.tenant_id || account.projectId;

              const vpcId =
                vpc.id || "N/A";

              const tags =
                await getHuaweiTags({

                  host:
                    `vpc.${account.region}.myhuaweicloud.com`,

                  uri:
                    `/v2.0/${tenantId}/vpcs/${vpcId}/tags`,

                  ak:
                    account.ak,

                  sk:
                    account.sk,

                  projectId:
                    account.projectId

                });

              return normalizeInventoryItem({

                uniqueKey:
                  `HUAWEI-${tenantId}-VPC-${vpcId}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  tenantId,

                service:
                  "VPC",

                resourceType:
                  "network",

                name:
                  vpc.name || "N/A",

                id:
                  vpcId,

                host:
                  vpc.cidr || "N/A",

                status:
                  "available",

                operatingSystem:
                  "N/A",

                platform:
                  "Huawei VPC",

                architecture:
                  "IPv4",

                availabilityZone:
                  account.region,

                tags,

                raw:
                  vpc

              });

            })

          );

        })

      );

    return inventory.flat();

  } catch (error: any) {

    console.error(

      "HUAWEI VPC ERROR:",

      error?.response?.data || error

    );

    return [];

  }

}