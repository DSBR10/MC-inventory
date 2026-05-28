import ObsClient from "esdk-obs-nodejs";

import {
  getHuaweiAccounts
} from "@/lib/huawei/accounts";

import {
  normalizeInventoryItem
} from "./normalize";

export async function getHuaweiOBSInventory() {

  try {

    const accounts =
      getHuaweiAccounts();

    const inventory =
      await Promise.all(

        accounts.map(async (account) => {

          const obsClient =
            new ObsClient({

              access_key_id:
                account.ak,

              secret_access_key:
                account.sk,

              server:
                `https://obs.${account.region}.myhuaweicloud.com`

            });

          const result =
            await obsClient.listBuckets();

          const buckets =
            result.InterfaceResult?.Buckets || [];

          return await Promise.all(

            buckets.map(async (bucket: any) => {

              const bucketName =

                bucket.BucketName ||

                bucket.Name ||

                bucket.name ||

                "unknown-bucket";

              let tags:
                Record<string, string> = {};

              try {

                const tagResult =
                  await obsClient.getBucketTagging({

                    Bucket:
                      bucketName

                  });

                const tagSet =

                  tagResult
                    ?.InterfaceResult
                    ?.Tags ||

                  tagResult
                    ?.InterfaceResult
                    ?.Tagging
                    ?.TagSet ||

                  [];

                for (const tag of tagSet) {

                  if (
                    tag.Key &&
                    tag.Value
                  ) {

                    tags[tag.Key] =
                      tag.Value;

                  }

                }

              } catch {}

              return normalizeInventoryItem({

                uniqueKey:
                  `HUAWEI-${account.projectId}-OBS-${bucketName}`,

                provider:
                  "HUAWEI CLOUD",

                accountName:
                  account.name,

                accountId:
                  account.projectId,

                service:
                  "OBS",

                resourceType:
                  "bucket",

                name:
                  bucketName,

                id:
                  bucketName,

                host:
                  `${bucketName}.obs.${account.region}.myhuaweicloud.com`,

              status:
                  "running",

                operatingSystem:
                  "N/A",

                platform:
                  "Object Storage",

                architecture:
                  account.region,

                availabilityZone:
                  account.region,

                publiclyExposed:
                  false,

                internetFacing:
                  false,

                tags,

                raw:
                  bucket

              });

            })

          );

        })

      );

    return inventory.flat();

  } catch (error: any) {

    console.error(
      "HUAWEI OBS ERROR:",
      error
    );

    return [];

  }

}