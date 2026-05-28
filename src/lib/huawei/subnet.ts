import {
  huaweiRequest
} from "./auth";

import {
  getHuaweiAccounts
} from "@/lib/huawei/accounts";

import {
  getHuaweiTags
} from "./tags";

export async function getHuaweiSubnetInventory() {

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
                `/v1/${account.projectId}/subnets`,

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId

            });

          const data = response?.data;

          if (!data || response?.status >= 400) {

            console.log(`[HUAWEI Subnet] No data for account ${account.name}`);
            return [];

          }

          const subnets =
            data.subnets || [];

          return await Promise.all(

            subnets.map(async (subnet: any) => {

              const tenantId =
                subnet.tenant_id || account.projectId;

              const subnetId =
                subnet.id || "N/A";

              const tags =
                await getHuaweiTags({

                  host:
                    `vpc.${account.region}.myhuaweicloud.com`,

                  uri:
                    `/v2.0/${tenantId}/subnets/${subnetId}/tags`,

                  ak:
                    account.ak,

                  sk:
                    account.sk,

                  projectId:
                    account.projectId

                });

              return {

                uniqueKey:
                  `HUAWEI-${tenantId}-SUBNET-${subnetId}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  tenantId,

                service:
                  "Subnet",

                resourceType:
                  "SUBNET",

                name:
                  subnet.name || "N/A",

                id:
                  subnetId,

                host:
                  subnet.cidr || "N/A",

                  status:
                  subnet.status === "ACTIVE"
                    ? "running"
                    : subnet.status?.toLowerCase() || "running", // Nunca UNKNOWN

                operatingSystem:
                  "N/A",

                vpcId:
                  subnet.vpc_id,

                topologyType:
                  "network",

                tags,

                raw:
                  subnet

              };

            })

          );

        })

      );

    return inventory.flat();

  } catch (error: any) {

    console.error(
      "HUAWEI SUBNET ERROR:",
      error?.response?.data || error
    );

    return [];

  }

}