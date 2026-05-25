import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
  ListTagsCommand,
} from "@aws-sdk/client-lambda";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

export async function getAWSLambdaInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new LambdaClient({
      region,
      credentials,
    });

    // List all functions
    const functionsData = await client.send(new ListFunctionsCommand({}));

    const inventory: any[] = [];

    for (const functionSummary of functionsData.Functions || []) {
      try {
        // Get detailed function info
        const functionData = await client.send(
          new GetFunctionCommand({
            FunctionName: functionSummary.FunctionName,
          }),
        );

        const func = functionData.Configuration;
        if (!func) continue;

        // Get tags
        let tags: Record<string, string> = {};
        try {
          if (func.FunctionArn) {
            const tagsData = await client.send(
              new ListTagsCommand({
                Resource: func.FunctionArn,
              }),
         );
            // Lambda returns tags as an object, not array
            tags = formatAwsTags(tagsData.Tags);
          }
        } catch (err) {
          console.error(`Lambda tags error for ${func.FunctionName}:`, err);
        }

        inventory.push({
          uniqueKey: `AWS-${account.id}-LAMBDA-${func.FunctionName}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "Lambda",
          name: func.FunctionName || "N/A",
          id: func.FunctionArn || "N/A",
          host: func.FunctionName || "N/A",
          status: func.State || "Active",
          operatingSystem: func.Runtime || "N/A",
          platform: func.Architectures?.[0] || "x86_64",
          architecture: func.MemorySize?.toString() + " MB",
          instanceType: func.MemorySize?.toString() + " MB",
          availabilityZone: region,
          tags,
          raw: {
            functionArn: func.FunctionArn,
            runtime: func.Runtime,
            role: func.Role,
            handler: func.Handler,
            codeSize: func.CodeSize,
            description: func.Description,
            timeout: func.Timeout,
            memorySize: func.MemorySize,
            codeSha256: func.CodeSha256,
            version: func.Version,
            lastModified: func.LastModified,
            lastUpdateStatus: func.LastUpdateStatus,
            architectures: func.Architectures,
            packageType: func.PackageType,
            runtimeVersionConfig: func.RuntimeVersionConfig,
            ephemeralStorage: func.EphemeralStorage,
            snapStart: func.SnapStart,
            fileSystemConfigs: func.FileSystemConfigs,
            vpcConfig: func.VpcConfig,
            environment: func.Environment?.Variables,
            deadLetterConfig: func.DeadLetterConfig,
            layers: func.Layers,
            concurrency: functionData.Concurrency,
          },
        });
      } catch (err) {
        console.error(
          `Lambda function error for ${functionSummary.FunctionName}:`,
          err,
        );
      }
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS Lambda ERROR:", error?.message || error);
    return [];
  }
}
