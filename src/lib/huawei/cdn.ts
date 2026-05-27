import { huaweiRequest } from "./auth";

import {
  getHuaweiAccounts,
  type HuaweiAccount
} from "./accounts";

import { getHuaweiTags } from "./tags";

import {
  normalizeInventoryItem
} from "./normalize";

export async function getHuaweiCDNInventory() {

  const accounts =
    getHuaweiAccounts();

  const allInventory: any[] = [];

  for (const account of accounts) {

    const inventory =
      await getAccountCDNInventory(account);

    allInventory.push(...inventory);

  }

  return allInventory;

}

async function getAccountCDNInventory(
  account: HuaweiAccount
) {

  try {

    const host =
      "cdn.myhuaweicloud.com";

    const response =
      await huaweiRequest({

        method: "GET",

        host,

        uri:
          "/v1.0/cdn/domains",

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

    const domains =
      response.data?.domains || [];

    const inventory: any[] = [];

    for (const domain of domains) {

      try {

        const detailResponse =
          await huaweiRequest({

            method: "GET",

            host,

            uri:
              `/v1.0/cdn/domains/${domain.id}`,

            ak:
              account.ak,

            sk:
              account.sk,

            projectId:
              account.projectId

          });

        const domainDetail =
          detailResponse?.data?.domain || {};

        const tags =
          await getHuaweiTags({

            host,

            uri:
              `/v1.0/cdn/domains/${domain.id}/tags`,

            ak:
              account.ak,

            sk:
              account.sk,

            projectId:
              account.projectId

          });

        inventory.push(

          normalizeInventoryItem({

            uniqueKey:
              `HUAWEI-${account.projectId}-CDN-${domain.id}`,

            provider:
              "HUAWEI CLOUD",

            accountName:
              account.name,

            accountId:
              account.projectId,

            service:
              "CDN",

            resourceType:
              "cdn",

            name:
              domain.domain_name || "N/A",

            id:
              domain.id || "N/A",

            host:
              domain.cname || "N/A",

            status:
              domain.domain_status || "UNKNOWN",

            operatingSystem:
              domainDetail.service_area || "Global",

            platform:
              domainDetail.business_type || "web",

            architecture:
              domainDetail.sources?.[0]?.origin_type || "ipaddr",

            instanceType:
              domainDetail.domain_type || "acceleration",

            availabilityZone:
              "Global",

            publiclyExposed:
              true,

            internetFacing:
              true,

            tags,

            raw: {

              ...domain,
              detail:
                domainDetail

            }

          })

        );

      } catch (err) {

        console.error(
          `Error CDN ${domain.domain_name}:`,
          err
        );

      }

    }

    return inventory;

  } catch (error: any) {

    console.error(
      "Error inventory CDN:",
      error.message
    );

    return [];

  }

}