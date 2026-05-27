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

export async function getHuaweiELBInventory() {

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
                `elb.${account.region}.myhuaweicloud.com`,

              uri:
                `/v2/${account.projectId}/elb/loadbalancers`,

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

          const loadBalancers =
            data.loadbalancers || [];

          const allRules =
            await getHuaweiSecurityGroupRules({

              ak:
                account.ak,

              sk:
                account.sk,

              projectId:
                account.projectId,

              region:
                account.region

            });

          return await Promise.all(

            loadBalancers.map(async (elb: any) => {

              const elbId =
                elb.id || "N/A";

              let tags: Record<string, string> = {};

              if (
                elb.tags &&
                Array.isArray(elb.tags)
              ) {

                for (const tag of elb.tags) {

                  if (
                    typeof tag === "string" &&
                    tag.includes("=")
                  ) {

                    const [key, ...rest] =
                      tag.split("=");

                    tags[key] =
                      rest.join("=");

                  }

                }

              }

              if (
                Object.keys(tags).length === 0
              ) {

                try {

                  tags =
                    await getHuaweiTags({

                      host:
                        `elb.${account.region}.myhuaweicloud.com`,

                      uri:
                        `/v2.0/${account.projectId}/elb/loadbalancers/${elbId}/tags`,

                      ak:
                        account.ak,

                      sk:
                        account.sk,

                      projectId:
                        account.projectId

                    });

                } catch {}

              }

              let listeners: any[] = [];

              try {

                const listenersData =
                  await huaweiRequest({

                    method: "GET",

                    host:
                      `elb.${account.region}.myhuaweicloud.com`,

                    uri:
                      `/v2/${account.projectId}/listeners`,

                    ak:
                      account.ak,

                    sk:
                      account.sk,

                    projectId:
                      account.projectId

                  });

                listeners =

                  (listenersData?.listeners || [])

                    .filter(
                      (listener: any) =>

                        listener.loadbalancer_id === elbId
                    )

                    .map((listener: any) => ({

                      name:
                        listener.name ||
                        listener.id,

                      protocol:
                        listener.protocol,

                      port:
                        listener.protocol_port,

                      arn:
                        listener.id

                    }));

              } catch {}

              const securityGroups =

                (elb.security_groups || []).map((sgId: string) => {

                  const rules =
                    allRules.filter(

                      (rule: any) =>

                        rule.security_group_id === sgId

                    );

                  return {

                    id:
                      sgId,

                    name:
                      sgId,

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

              const internetFacing =

                elb.type === "External";

              return {

                uniqueKey:
                  `HUAWEI-${account.projectId}-ELB-${elbId}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  account.projectId,

                service:
                  "ELB",

                resourceType:
                  "LOAD_BALANCER",

                name:
                  elb.name || "N/A",

                id:
                  elbId,

                host:
                  elb.vip_address || "N/A",

                privateIp:
                  internetFacing
                    ? undefined
                    : elb.vip_address,

                publicIp:
                  internetFacing
                    ? elb.vip_address
                    : undefined,

                status:
                  elb.status || "available",

                operatingSystem:
                  "N/A",

                listeners,

                securityGroups,

                vpcId:
                  elb.vpc_id,

                subnetId:
                  elb.vip_subnet_id,

                publiclyExposed:
                  internetFacing,

                internetFacing,

                topologyType:
                  "entrypoint",

                tags,

                raw:
                  elb

              };

            })

          );

        })

      );

    return inventory.flat();

  } catch (error: any) {

    console.error(
      "HUAWEI ELB ERROR:",
      error?.response?.data || error
    );

    return [];

  }

}