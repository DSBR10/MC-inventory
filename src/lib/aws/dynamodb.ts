import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  ListTagsOfResourceCommand,
  DescribeTimeToLiveCommand,
  DescribeContinuousBackupsCommand,
} from "@aws-sdk/client-dynamodb";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

const region = process.env.AWS_REGION || "us-east-1";

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.name === 'ThrottlingException' && i < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(2, i);
        await delay(delayMs);
        continue;
      }
      throw error;
    }
  }
  return null;
}

export async function getAWSDynamoDBInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new DynamoDBClient({
      region,
      credentials,
    });

    // List all tables
    const tablesData = await client.send(new ListTablesCommand({}));

    const inventory: any[] = [];

    for (const tableName of tablesData.TableNames || []) {
      try {
        // Get table details
        const tableData = await client.send(
          new DescribeTableCommand({
            TableName: tableName,
          }),
        );

        const table = tableData.Table;
        if (!table) continue;
        const tableDetails = table as any;

        // Get TTL status with retry
        let ttlEnabled = false;
        try {
          const ttlData = await retryWithBackoff(() =>
            client.send(
              new DescribeTimeToLiveCommand({
                TableName: tableName,
              }),
            )
          );
          if (ttlData) {
            ttlEnabled =
           ttlData.TimeToLiveDescription?.TimeToLiveStatus === "ENABLED";
          }
          // Add small delay between calls to avoid throttling
          await delay(200);
        } catch (err) {
          console.error(`DynamoDB TTL error for ${tableName}:`, err);
        }

        // Get backup settings with retry
        let pointInTimeRecovery = false;
        try {
          const backupData = await retryWithBackoff(() =>
            client.send(
              new DescribeContinuousBackupsCommand({
                TableName: tableName,
              }),
            )
          );
          if (backupData) {
            pointInTimeRecovery =
              backupData.ContinuousBackupsDescription
                ?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus ===
              "ENABLED";
          }
          // Add small delay between calls to avoid throttling
          await delay(200);
        } catch (err) {
          console.error(`DynamoDB backup error for ${tableName}:`, err);
        }

        // Get tags
        let tags: Record<string, string> = {};
        try {
          if (table.TableArn) {
            const tagsData = await client.send(
              new ListTagsOfResourceCommand({
                ResourceArn: table.TableArn,
              }),
            );
            tags = formatAwsTags(tagsData.Tags || []);
          }
        } catch (err) {
          console.error(`DynamoDB tags error for ${tableName}:`, err);
        }

        inventory.push({
          uniqueKey: `AWS-${account.id}-DYNAMODB-${tableName}`,
          provider: "AWS",
          accountName: account.name,
          accountId: account.id,
          service: "DynamoDB",
          name: tableName,
          id: table.TableId || "N/A",
          host: table.TableArn || "N/A",
          status: table.TableStatus || "UNKNOWN",
          operatingSystem: table.TableStatus || "N/A",
          platform: tableDetails.BillingMode || "PROVISIONED",
          architecture: table.KeySchema?.[0]?.KeyType || "N/A",
          instanceType:
            table.KeySchema?.find((k) => k.KeyType === "HASH")?.AttributeName ||
            "N/A",
          availabilityZone: region,
          tags,
          raw: {
            arn: table.TableArn,
            partitionKey: table.KeySchema?.find((k) => k.KeyType === "HASH")
              ?.AttributeName,
            sortKey: table.KeySchema?.find((k) => k.KeyType === "RANGE")
              ?.AttributeName,
            attributeDefinitions: table.AttributeDefinitions,
            globalSecondaryIndexes: table.GlobalSecondaryIndexes?.map(
              (idx) => ({
                name: idx.IndexName,
                status: idx.IndexStatus,
                partitionKey: idx.KeySchema?.find((k) => k.KeyType === "HASH")
                  ?.AttributeName,
                sortKey: idx.KeySchema?.find((k) => k.KeyType === "RANGE")
                  ?.AttributeName,
                projectionType: idx.Projection?.ProjectionType,
              }),
            ),
            localSecondaryIndexes: table.LocalSecondaryIndexes?.map((idx) => ({
              name: idx.IndexName,
              partitionKey: idx.KeySchema?.find((k) => k.KeyType === "HASH")
                ?.AttributeName,
              sortKey: idx.KeySchema?.find((k) => k.KeyType === "RANGE")
                ?.AttributeName,
              projectionType: idx.Projection?.ProjectionType,
            })),
            provisionedThroughput: table.ProvisionedThroughput,
            streamSpecification: table.StreamSpecification,
            sseDescription: table.SSEDescription,
            ttlEnabled,
            pointInTimeRecovery,
            itemCount: table.ItemCount,
            tableSizeBytes: table.TableSizeBytes,
            deletionProtection: table.DeletionProtectionEnabled,
          },
        });
      } catch (err) {
        console.error(`DynamoDB table error for ${tableName}:`, err);
      }
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS DynamoDB ERROR:", error?.message || error);
    return [];
  }
}
