import {
  huaweiRequest
} from "./auth";

import {
  getHuaweiAccounts
} from "./accounts";

import {
  getHuaweiTags
} from "./tags";

import {
  getHuaweiSecurityGroupRules
} from "./security-groups";

export async function getHuaweiECSInventory() {

  try {

    const accounts =
      getHuaweiAccounts();

    const inventory =
      await Promise.all(

        accounts.map(async (account) => {

          const [
            data,
            allRules
          ] = await Promise.all([

            huaweiRequest({

              method: "GET",

              host:
                `ecs.${account.region}.myhuaweicloud.com`,

              uri:
                `/v1/${account.projectId}/cloudservers/detail`,

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId

            }),

            getHuaweiSecurityGroupRules({

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId,

              region:
                account.region

            })

          ]);

          if (!data) {

            return [];

          }

          const servers =
            data.servers || [];

          return await Promise.all(

            servers.map(async (server: any) => {

              let hostIp = "N/A";

              if (server.addresses) {

                const networks =
                  Object.values(
                    server.addresses
                  ) as any[];

                if (
                  networks.length > 0 &&
                  networks[0].length > 0
                ) {

                  hostIp =
                    networks[0][0]?.addr || "N/A";

                }

              }

              const serverId =
                server.id || "N/A";

              const tags =
                await getHuaweiTags({

                  host:
                    `ecs.${account.region}.myhuaweicloud.com`,

                  uri:
                    `/v1/${account.projectId}/cloudservers/${serverId}/tags`,

                  ak:
                    account.ak,

                  sk:
                    account.sk,

                  projectId:
                    account.projectId

                });

              const securityGroups =

                (server.security_groups || []).map((sg: any) => {

                  const rules =
                    allRules.filter(

                      (rule: any) =>

                        rule.security_group_id === sg.id

                    );

                  return {

                    id:
                      sg.id || "N/A",

                    name:
                      sg.name || "N/A",

                    inboundRules:

                      rules

                        .filter(
                          (rule: any) =>

                            rule.direction === "ingress"
                        )

                        .map((rule: any) => ({

                          protocol:
                            rule.protocol || "ALL",

                          fromPort:
                            rule.port_range_min,

                          toPort:
                            rule.port_range_max,

                          cidr:
                            rule.remote_ip_prefix || "0.0.0.0/0",

                          direction:
                            "inbound"

                        })),

                    outboundRules:

                      rules

                        .filter(
                          (rule: any) =>

                            rule.direction === "egress"
                        )

                        .map((rule: any) => ({

                          protocol:
                            rule.protocol || "ALL",

                          fromPort:
                            rule.port_range_min,

                          toPort:
                            rule.port_range_max,

                          cidr:
                            rule.remote_ip_prefix || "0.0.0.0/0",

                          direction:
                            "outbound"

                        }))

                  };

                });

              return {

                uniqueKey:
                  `HUAWEI-${account.projectId}-ECS-${serverId}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  account.projectId,

                service:
                  "ECS",

                name:
                  server.name || "N/A",

                id:
                  serverId,

                host:
                  hostIp,

                status:

                  server.status === "ACTIVE"
                    ? "running"
                    : server.status === "SHUTOFF"
                    ? "stopped"
                    : server.status || "UNKNOWN",

                operatingSystem:
                  "Linux",

                securityGroups,

                tags

              };

            })

          );

        })

      );

    return inventory.flat();

  } catch (error: any) {

    console.error(
      "HUAWEI ECS ERROR:",
      error?.response?.data || error
    );

    return [];

  }

}