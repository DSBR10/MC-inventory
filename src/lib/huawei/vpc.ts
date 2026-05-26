import {
  huaweiRequest
} from "./auth";

import {
  getHuaweiAccounts
} from "@/lib/huawei/accounts";

import {
  getHuaweiTags
} from "./tags";

export async function getHuaweiVPCInventory() {

  try {

    const accounts =
      getHuaweiAccounts();

    const inventory =
      await Promise.all(

        accounts.map(async (account) => {

          const data =
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

          if (!data) {

            return [];

          }

          const vpcs =
            data.vpcs || [];

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

              return {

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

                tags

              };

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