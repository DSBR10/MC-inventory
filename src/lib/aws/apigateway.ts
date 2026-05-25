import {
  APIGatewayClient,
  GetRestApisCommand,
  GetResourcesCommand,
  GetStagesCommand,
  GetUsagePlansCommand,
  GetApiKeysCommand,
} from "@aws-sdk/client-api-gateway";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

export async function getAWSAPIGatewayInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new APIGatewayClient({
      region,
      credentials,
    });

    const inventory: any[] = [];

    // Get REST APIs
    const restApisData = await client.send(new GetRestApisCommand({}));

    for (const api of restApisData.items || []) {
      try {
        // Get stages
        const stagesData = await client.send(
          new GetStagesCommand({
            restApiId: api.id,
          }),
        );

        // Get resources
        const resourcesData = await client.send(
          new GetResourcesCommand({
            restApiId: api.id,
          }),
        );

        // Get usage plans
        const usagePlansData = await client.send(new GetUsagePlansCommand({}));

        inventory.push({
          uniqueKey: `AWS-${account.id}-APIGATEWAY-${api.id}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "API Gateway",
          name: api.name || "N/A",
          id: api.id || "N/A",
          host: api.endpointConfiguration?.types?.[0] || "N/A",
          status: api.status || "AVAILABLE",
          operatingSystem: api.apiKeySource || "N/A",
          platform: api.endpointConfiguration?.types?.join(", ") || "N/A",
          architecture: api.version || "N/A",
          instanceType: api.binaryMediaTypes?.length?.toString() || "N/A",
          availabilityZone: region,
          tags: formatAwsTags(api.tags),
          raw: {
            arn: api.apiEndpoint,
            description: api.description,
            createdDate: api.createdDate,
            version: api.version,
            binaryMediaTypes: api.binaryMediaTypes,
            minimumCompressionSize: api.minimumCompressionSize,
            endpointConfiguration: api.endpointConfiguration,
            policy: api.policy,
            stages: stagesData.item?.map((s: any) => ({
            stageName: s.stageName,
              deploymentId: s.deploymentId,
              description: s.description,
            })),
            resources: {
              total: resourcesData.items?.length || 0,
              items: resourcesData.items?.map((r) => ({
                id: r.id,
                path: r.path,
                methods: Object.keys(r.resourceMethods || {}),
              })),
            },
            usagePlans: usagePlansData.items?.length || 0,
          },
        });
      } catch (err) {
        console.error(`API Gateway error for ${api.id}:`, err);
      }
    }

    // Get API Keys
    try {
      const apiKeysData = await client.send(new GetApiKeysCommand({}));

      for (const key of apiKeysData.items || []) {
        inventory.push({
          uniqueKey: `AWS-${account.id}-APIGATEWAY-KEY-${key.id}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "API Gateway",
          name: key.name || "N/A",
          id: key.id || "N/A",
          host: key.apiId || "N/A",
          status: key.enabled ? "Enabled" : "Disabled",
          operatingSystem: key.stageKey?.[0] || "N/A",
          platform: "API Key",
          architecture: "N/A",
          instanceType: key.usagePlanKeys?.length?.toString() || "N/A",
          availabilityZone: region,
          tags: {},
          raw: {
            description: key.description,
            createdDate: key.createdDate,
            lastUpdated: key.lastUpdatedDate,
            stageKeys: key.stageKey,
            usagePlanKeys: key.usagePlanKeys,
          },
        });
      }
    } catch (err) {
      console.error("API Gateway Keys error:", err);
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS API Gateway ERROR:", error?.message || error);
    return [];
  }
}
