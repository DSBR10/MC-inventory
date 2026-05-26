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

          /* ───────────────────────────── */
          /* LOAD BALANCERS */
          /* ───────────────────────────── */

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

          /* ───────────────────────────── */
          /* SECURITY GROUP RULES */
          /* ───────────────────────────── */

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

              /* ───────────────────────── */
              /* TAGS */
              /* ───────────────────────── */

              let tags: Record<string, string> = {};

              // First try to extract tags from the ELB resource directly
              if (elb.tags && Array.isArray(elb.tags)) {
                for (const tag of elb.tags) {
                  if (typeof tag === "string" && tag.includes("=")) {
                    // Format: "key=value"
                    const [key, ...rest] = tag.split("=");
                    tags[key] = rest.join("=");
                  } else if (tag.key && tag.value) {
                    // Format: {key: "k", value: "v"}
                    tags[tag.key] = tag.value;
                  }
                }
              }

              // If no tags from resource, try the tags API
              if (Object.keys(tags).length === 0) {
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
                } catch {
                  tags = {};
                }
              }

              /* ───────────────────────── */
              /* LISTENERS */
              /* ───────────────────────── */

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
                        listener.id ||
                        "listener",

                      protocol:
                        listener.protocol || "TCP",

                      port:
                        listener.protocol_port || 0,

                      arn:
                        listener.id

                    }));

              } catch {

                listeners = [];

              }

              /* ───────────────────────── */
              /* SECURITY GROUPS */
              /* ───────────────────────── */

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

              /* ───────────────────────── */
              /* INTERNET EXPOSURE */
              /* ───────────────────────── */

              const internetFacing =

                elb.type === "External" ||

                !!elb.vip_address;

              /* ───────────────────────── */
              /* NORMALIZED INVENTORY */
              /* ───────────────────────── */

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

                name:
                  elb.name || "N/A",

                id:
                  elbId,

                host:
                  elb.vip_address || "N/A",

                privateIp:
                  elb.vip_address || undefined,

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
                  "LOAD_BALANCER",

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