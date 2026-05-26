import { huaweiRequest } from "./auth";

type HuaweiSecurityGroupRule = {
  id: string;
  security_group_id: string;
  direction: "ingress" | "egress";
  protocol?: string;
  port_range_min?: number;
  port_range_max?: number;
  remote_ip_prefix?: string;
};

type Params = {
  ak: string;
  sk: string;
  projectId: string;
  region?: string;
};

export async function getHuaweiSecurityGroupRules({
  ak,
  sk,
  projectId,
  region
}: Params) {

  try {

    const actualRegion = region || "la-north-2";

    const data =
      await huaweiRequest({

        method: "GET",

        host:
          `vpc.${actualRegion}.myhuaweicloud.com`,

        uri:
          `/v1/${projectId}/security-group-rules`,

        ak,
        sk,
        projectId

      });

    return (
      data?.security_group_rules || []
    ) as HuaweiSecurityGroupRule[];

  } catch (error: any) {

    console.error(
      "HUAWEI SECURITY GROUP RULES ERROR:",
      error?.response?.data || error
    );

    return [];

  }

}