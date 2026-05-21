import {

  CostExplorerClient,
  GetCostAndUsageCommand

} from "@aws-sdk/client-cost-explorer";

import {
  BillingItem
} from "@/types/billing";

import {
  getAWSAccounts
} from "@/lib/aws/accounts";

const TAG_KEYS = [

  "Cliente",
  "Proyecto",
  "Environment",
  "Owner",
  "CostCenter"

];

function getKey(
  item: BillingItem
) {

  return [

    item.provider,
    item.accountId,
    item.service,
    item.month

  ].join("|");

}

function extractTagValue(
  raw: string
) {

  if (!raw) {

    return "Sin tag";

  }

  if (raw.includes("$")) {

    return (
      raw.split("$")[1]
      || "Sin tag"
    );

  }

  return raw;

}

export async function getAWSBilling():
Promise<BillingItem[]> {

  try {

    const accounts =
      getAWSAccounts();

    const consolidated:
      Record<string, BillingItem> = {};

    for (const account of accounts) {

      const client =
        new CostExplorerClient({

          region: "us-east-1",

          credentials: {

            accessKeyId:
              account.accessKeyId,

            secretAccessKey:
              account.secretAccessKey

          }

        });

      const now =
        new Date();

      const start =
        new Date(

          now.getFullYear(),
          now.getMonth() - 5,
          1

        );

      const end =
        new Date(

          now.getFullYear(),
          now.getMonth() + 1,
          1

        );

      /*
        Base billing
      */

      const baseResponse =
        await client.send(

          new GetCostAndUsageCommand({

            TimePeriod: {

              Start:
                start
                  .toISOString()
                  .split("T")[0],

              End:
                end
                  .toISOString()
                  .split("T")[0]

            },

            Granularity:
              "MONTHLY",

            Metrics: [
              "UnblendedCost"
            ],

            GroupBy: [

              {
                Type: "DIMENSION",
                Key: "SERVICE"
              }

            ]

          })

        );

      /*
        Base rows
      */

      for (
        const period of
        baseResponse.ResultsByTime || []
      ) {

        const month =
          period.TimePeriod?.Start
            ?.slice(0, 7) || "";

        for (
          const group of
          period.Groups || []
        ) {

          const service =
            group.Keys?.[0]
            || "Unknown";

          if (
            service === "__tag__"
          ) {

            continue;

          }

          const cost =
            Number(

              group.Metrics
                ?.UnblendedCost
                ?.Amount || 0

            );

          if (cost <= 0) {

            continue;

          }

          const item:
            BillingItem = {

            provider:
              "AWS",

            accountName:
              account.name,

            accountId:
              account.id,

            service,

            region:
              "global",

            cost,

            currency:
              group.Metrics
                ?.UnblendedCost
                ?.Unit || "USD",

            month,

            tags: {}

          };

          consolidated[
            getKey(item)
          ] = item;

        }

      }

      /*
        Tag enrichment
      */

      for (
        const tagKey of TAG_KEYS
      ) {

        const tagResponse =
          await client.send(

            new GetCostAndUsageCommand({

              TimePeriod: {

                Start:
                  start
                    .toISOString()
                    .split("T")[0],

                End:
                  end
                    .toISOString()
                    .split("T")[0]

              },

              Granularity:
                "MONTHLY",

              Metrics: [
                "UnblendedCost"
              ],

              GroupBy: [

                {
                  Type: "DIMENSION",
                  Key: "SERVICE"
                },

                {
                  Type: "TAG",
                  Key: tagKey
                }

              ]

            })

          );

        for (
          const period of
          tagResponse.ResultsByTime || []
        ) {

          const month =
            period.TimePeriod?.Start
              ?.slice(0, 7) || "";

          for (
            const group of
            period.Groups || []
          ) {

            const service =
              group.Keys?.[0]
              || "Unknown";

            const rawTag =
              group.Keys?.[1]
              || "";

            const tagValue =
              extractTagValue(
                rawTag
              );

            const temp:
              BillingItem = {

              provider:
                "AWS",

              accountName:
                account.name,

              accountId:
                account.id,

              service,

              month,

              cost: 0,

              currency:
                "USD"

            };

            const key =
              getKey(temp);

            if (
              !consolidated[key]
            ) {

              continue;

            }

            consolidated[
              key
            ].tags = {

              ...(consolidated[
                key
              ].tags || {}),

              [tagKey]:
                tagValue

            };

          }

        }

      }

    }

    return Object.values(
      consolidated
    );

  } catch (error) {

    console.error(
      "AWS BILLING ERROR:",
      error
    );

    return [];

  }

}