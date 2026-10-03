import {

  RDSClient,
  DescribeDBInstancesCommand,
  ListTagsForResourceCommand

} from "@aws-sdk/client-rds";

import {
  formatAwsTags
} from "./tags";

import type {
  AWSAccount
} from "./accounts";

const ENABLE_RDS_TAGS =
  process.env.ENABLE_RDS_TAGS === "true";

export async function getAWSRDSInventory(

  account: AWSAccount

) {

  try {

    const credentials = {

      accessKeyId:
        account.accessKeyId,

      secretAccessKey:
        account.secretAccessKey

    };

    const client =
      new RDSClient({

        region: account.region,
        credentials

      });

    const data =
      await client.send(

        new DescribeDBInstancesCommand({})

      );

    return await Promise.all(

      (data.DBInstances || []).map(

        async (db) => {

          const id =
            db.DBInstanceIdentifier || "";

          let tags:
            Record<string, string> = {};

          /* ───────────────────────────── */
          /* TAGS */
          /* ───────────────────────────── */

          try {

            const arn =
              db.DBInstanceArn;

            if (
              arn &&
              ENABLE_RDS_TAGS
            ) {

              const tagData =
                await client.send(

                  new ListTagsForResourceCommand({

                    ResourceName:
                      arn

                  })

                );

              tags =
                formatAwsTags(

                  tagData.TagList || []

                );

            }

          } catch (err) {

            console.error(

              `RDS TAG ERROR (${id}):`,

              err

            );

            tags = {};

          }

          return {

            uniqueKey:
              `AWS-${account.id}-RDS-${id}`,

            provider:
              "AWS",

            accountName:
              account.name,

            accountId:
              account.id,

            service:
              "RDS",

            name:
              id,

            operatingSystem:
              db.Engine || "N/A",

            id,

            host:
              db.Endpoint?.Address || "N/A",

            status:
              db.DBInstanceStatus || "UNKNOWN",

            securityGroups:

              (
                db.VpcSecurityGroups || []
              ).map((sg) => ({

                id:
                  sg.VpcSecurityGroupId || "N/A",

                name:
                  sg.Status || "attached"

              })),

            tags

          };

        }

      )

    );

  } catch (error: any) {

    console.error(

      "AWS RDS ERROR:",

      error?.message || error

    );

    return [];

  }

}