import {
  huaweiRequest
} from "./auth";

import {
  getHuaweiAccounts
} from "./accounts";

import {
  getHuaweiTags
} from "./tags";

export async function getHuaweiRDSInventory() {

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
                `rds.${account.region}.myhuaweicloud.com`,

              uri:
                `/v3/${account.projectId}/instances`,

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId

            });

          const data = response?.data;

          if (!data || response?.status >= 400) {

            console.log(`[HUAWEI RDS] No data for account ${account.name}`);
            return [];

          }

          const instances =
            data.instances || [];

          return await Promise.all(

            instances.map(async (db: any) => {

              const dbId =
                db.id || "N/A";

              const tags =
                await getHuaweiTags({

                  host:
                    `rds.${account.region}.myhuaweicloud.com`,

                  uri:
                    `/v3/${account.projectId}/instances/${dbId}/tags`,

                  ak:
                    account.ak,

                  sk:
                    account.sk,

                  projectId:
                    account.projectId

                });

              const privateIp =
                db.private_ips?.[0];

              return {

                uniqueKey:
                  `HUAWEI-${account.projectId}-RDS-${dbId}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  account.projectId,

                service:
                  "RDS",

                resourceType:
                  "DATABASE",

                name:
                  db.name || "N/A",

                id:
                  dbId,

                host:
                  privateIp || "N/A",

                privateIp,

                publicIp:
                  undefined,

                publiclyExposed:
                  false,

                internetFacing:
                  false,

                status:
                  db.status === "ACTIVE"
                    ? "running"
                    : db.status === "SHUTOFF"
                    ? "stopped"
                    : db.status === "SHUTDOWN"
                    ? "stopped"
                    : db.status?.toLowerCase() || "running", // Nunca UNKNOWN

                operatingSystem:
                  `${db.datastore?.type || "RDS"} ${db.datastore?.version || ""}`,

                platform:
                  db.datastore?.type,

                architecture:
                  db.mode,

                instanceType:
                  db.flavor_ref,

                availabilityZone:
                  db.availability_zone,

                vpcId:
                  db.vpc_id,

                subnetId:
                  db.subnet_id,

                topologyType:
                  "database",

                tags,

                raw:
                  db

              };

            })

          );

        })

      );

    return inventory.flat();

  } catch (error: any) {

    console.error(
      "HUAWEI RDS ERROR:",
      error?.response?.data || error
    );

    return [];

  }

}