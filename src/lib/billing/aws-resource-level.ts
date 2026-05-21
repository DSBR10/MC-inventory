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

export async function getAWSResourceLevelBilling():
Promise<BillingItem[]> {

  try {

    const accounts =
      getAWSAccounts();

    const results =
      await Promise.all(

        accounts.map(async (account) => {

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

              now.getMonth() - 1,

              1

            );

          const end =
            new Date(

              now.getFullYear(),

              now.getMonth(),

              1

            );

          const command =
            new GetCostAndUsageCommand({

              TimePeriod: {

                Start:
                  start.toISOString()
                    .split("T")[0],

                End:
                  end.toISOString()
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
                  Type: "DIMENSION",
                  Key: "RESOURCE_ID"
                }

              ]

            });

          const response =
            await client.send(command);

          const groups =

            response.ResultsByTime?.[0]
              ?.Groups || [];

          return groups

            .map((group) => {

              const service =
                group.Keys?.[0]
                || "Unknown";

              const resourceId =
                group.Keys?.[1]
                || "Unknown";

              const cost =
                Number(

                  group.Metrics
                    ?.UnblendedCost
                    ?.Amount || 0

                );

              if (cost <= 0) {

                return null;

              }

              return {

                provider:
                  "AWS",

                accountName:
                  account.name,

                accountId:
                  account.id,

                service,

                resourceId,

                resourceName:
                  resourceId,

                cost,

                currency:
                  "USD",

                month:
                  start.toISOString()
                    .slice(0, 7),

                tags: {}

              } as BillingItem;

            })

            .filter(Boolean);

        })

      );

    return results
      .flat()
      .flat() as BillingItem[];

  } catch (error) {

    console.error(

      "AWS RESOURCE BILLING ERROR:",

      error

    );

    return [];

  }

}