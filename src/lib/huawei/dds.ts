// Huawei Cloud DDS (Document Database Service)

import { huaweiRequest } from "./auth";

import {
  getHuaweiAccounts,
  type HuaweiAccount
} from "./accounts";

import { getHuaweiTags } from "./tags";

export async function getHuaweiDDSInventory() {

  const accounts =
    getHuaweiAccounts();

  const allInventory: any[] = [];

  for (const account of accounts) {

    const inventory =
      await getAccountDDSInventory(account);

    allInventory.push(...inventory);

  }

  return allInventory;

}

async function getAccountDDSInventory(
  account: HuaweiAccount
) {

  try {

    const host =
      `dds.${account.region}.myhuaweicloud.com`;

    const data =
      await huaweiRequest({

        method: "GET",

        host,

        uri:
          `/v3/${account.projectId}/instances`,

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

    const instances =
      data.instances || [];

    const inventory: any[] = [];

    for (const instance of instances) {

      try {

        const detailData =
          await huaweiRequest({

            method: "GET",

            host,

            uri:
              `/v3/${account.projectId}/instances/${instance.id}`,

            ak:
              account.ak,

            sk:
              account.sk,

            projectId:
              account.projectId

          });

        const instanceDetail =
          detailData?.instance || {};

        const tags =
          await getHuaweiTags({

            host,

            uri:
              `/v3/${account.projectId}/instances/${instance.id}/tags`,

            ak:
              account.ak,

            sk:
              account.sk,

            projectId:
              account.projectId

          });

        const privateIp =

          instanceDetail.private_ips?.[0];

        inventory.push({

          uniqueKey:
            `HUAWEI-${account.projectId}-DDS-${instance.id}`,

          provider:
            "HUAWEI CLOUD",

          accountName:
            account.name,

          accountId:
            account.projectId,

          service:
            "DDS",

          resourceType:
            "DATABASE",

          name:
            instance.name || "N/A",

          id:
            instance.id || "N/A",

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
            instance.status || "UNKNOWN",

          operatingSystem:
            instanceDetail.engine || "mongodb",

          platform:
            instanceDetail.engine_version,

          architecture:
            instanceDetail.mode,

          instanceType:
            instanceDetail.flavor?.spec_code,

          availabilityZone:
            instanceDetail.availability_zone,

          vpcId:
            instanceDetail.vpc_id,

          subnetId:
            instanceDetail.subnet_id,

          topologyType:
            "database",

          tags,

          raw: {

            id:
              instance.id,

            region:
              instanceDetail.region,

            mode:
              instanceDetail.mode,

            engine:
              instanceDetail.engine,

            engineVersion:
              instanceDetail.engine_version,

            dbPort:
              instanceDetail.port,

            groups:
              instanceDetail.groups,

            datastore:
              instanceDetail.datastore

          }

        });

      } catch (err) {

        console.error(
          `Error DDS ${instance.name}:`,
          err
        );

      }

    }

    return inventory;

  } catch (error: any) {

    console.error(
      "Error DDS:",
      error.message
    );

    return [];

  }

}