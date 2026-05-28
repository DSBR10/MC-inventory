import { huaweiRequest } from "./auth";

import { getHuaweiAccounts } from "./accounts";

import { getHuaweiTags } from "./tags";

import { getHuaweiSecurityGroupRules } from "./security-groups";

export async function getHuaweiECSInventory(excludeServerIds: string[] = []) {
  try {
    const accounts = getHuaweiAccounts();

    if (accounts.length === 0) {
      console.log("⚠️  No Huawei accounts configured for ECS");
      return [];
    }

    if (excludeServerIds.length > 0) {
      console.log(
        `🚫 [ECS] Excluyendo ${excludeServerIds.length} nodos CCE de la lista`,
      );
    }

    const inventory = await Promise.all(
      accounts.map(async (account) => {
        const [response, allRules] = await Promise.all([
          huaweiRequest({
            method: "GET",

            host: `ecs.${account.region}.myhuaweicloud.com`,

            uri: `/v1/${account.projectId}/cloudservers/detail`,

            ak: account.ak,

            sk: account.sk,

            projectId: account.projectId,
          }),

          getHuaweiSecurityGroupRules({
            ak: account.ak,

            sk: account.sk,

            projectId: account.projectId,

            region: account.region,
          }),
        ]);

        const data = response?.data;

        if (!data || response?.status >= 400) {
          return [];
        }

        let servers = data.servers || [];

        // Filtrar servidores que son nodos CCE
        if (excludeServerIds.length > 0) {
          const beforeCount = servers.length;
          servers = servers.filter(
            (server: any) => !excludeServerIds.includes(server.id),
          );
          const filteredCount = beforeCount - servers.length;
          if (filteredCount > 0) {
            console.log(
              `  ✅ [${account.name}] Filtrados ${filteredCount} nodos CCE de ${beforeCount} servidores ECS`,
            );
          }
        }

        return await Promise.all(
          servers.map(async (server: any) => {
            let privateIp: string | undefined;

            let publicIp: string | undefined;

            let hostIp = "N/A";

            if (server.addresses) {
              const networks = Object.values(server.addresses) as any[];

              for (const network of networks) {
                for (const addr of network as any[]) {
                  if (addr["OS-EXT-IPS:type"] === "floating") {
                    publicIp = addr.addr;
                  } else {
                    privateIp = addr.addr;
                  }
                }
              }
            }

            hostIp = publicIp || privateIp || "N/A";

            const serverId = server.id || "N/A";

            const tags = await getHuaweiTags({
              host: `ecs.${account.region}.myhuaweicloud.com`,

              uri: `/v1/${account.projectId}/cloudservers/${serverId}/tags`,

              ak: account.ak,

              sk: account.sk,

              projectId: account.projectId,
            });

            const securityGroups = (server.security_groups || []).map(
              (sg: any) => {
                const rules = allRules.filter(
                  (rule: any) => rule.security_group_id === sg.id,
                );

                return {
                  id: sg.id || "N/A",

                  name: sg.name || "N/A",

                  inboundRules: rules

                    .filter((rule: any) => rule.direction === "ingress")

                    .map((rule: any) => ({
                      protocol: rule.protocol || "ALL",

                      fromPort: rule.port_range_min,

                      toPort: rule.port_range_max,

                      cidr: rule.remote_ip_prefix || "0.0.0.0/0",

                      direction: "inbound",
                    })),

                  outboundRules: rules

                    .filter((rule: any) => rule.direction === "egress")

                    .map((rule: any) => ({
                      protocol: rule.protocol || "ALL",

                      fromPort: rule.port_range_min,

                      toPort: rule.port_range_max,

                      cidr: rule.remote_ip_prefix || "0.0.0.0/0",

                      direction: "outbound",
                    })),
                };
              },
            );

            return {
              uniqueKey: `HUAWEI-${account.projectId}-ECS-${serverId}`,

              provider: "HUAWEI CLOUD",

              accountName: account.name,

              accountId: account.projectId,

              service: "ECS",

              resourceType: "COMPUTE_INSTANCE",

              name: server.name || "N/A",

              id: serverId,

              host: hostIp,

              privateIp,

              publicIp,

              publiclyExposed: !!publicIp,

              internetFacing: !!publicIp,

              status:
                server.status === "ACTIVE"
                  ? "running"
                  : server.status === "SHUTOFF"
                    ? "stopped"
                    : server.status?.toLowerCase() || "running", // Nunca UNKNOWN

              operatingSystem: server.metadata?.os_type || "Linux",

              platform: server["OS-EXT-SRV-ATTR:hypervisor_hostname"],

              architecture: server.metadata?.arch || "x86_64",

              instanceType: server.flavor?.name || server.flavor?.id,

              availabilityZone: server["OS-EXT-AZ:availability_zone"],

              launchTime: server.created,

              imageId: server.image?.id,

              vpcId: server.metadata?.vpc_id,

              subnetId: server.metadata?.subnet_id,

              securityGroups,

              topologyType: "compute",

              tags,

              raw: server,
            };
          }),
        );
      }),
    );

    return inventory.flat();
  } catch (error: any) {
    console.error(
      "❌ HUAWEI ECS ERROR:",
      error?.response?.data || error?.message || error,
    );

    return [];
  }
}
