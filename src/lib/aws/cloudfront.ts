import {
  CloudFrontClient,
  ListDistributionsCommand,
  GetDistributionCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-cloudfront";

import { formatAwsTags } from "./tags";

import type { AWSAccount } from "./accounts";

export async function getAWSCloudFrontInventory(account: AWSAccount) {
  try {
    const credentials = {
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey,
    };

    const client = new CloudFrontClient({
      region: "us-east-1", // CloudFront is global
      credentials,
    });

    // List all distributions
    const data = await client.send(new ListDistributionsCommand({}));

    const inventory: any[] = [];

    for (const distSummary of data.DistributionList?.Items || []) {
      // Get detailed distribution info
      let tags: Record<string, string> = {};

      try {
        const tagsData = await client.send(
          new ListTagsForResourceCommand({
            Resource: distSummary.ARN,
          }),
        );
        tags = formatAwsTags(tagsData.Tags?.Items || []);
      } catch (err) {
        console.error(`CloudFront tags error for ${distSummary.Id}:`, err);
      }

      const detail = await client.send(
        new GetDistributionCommand({
          Id: distSummary.Id,
        }),
      );

      const dist = detail.Distribution;
      if (!dist) continue;
      const distributionConfig = dist.DistributionConfig as any;
      const defaultCacheBehavior = dist.DistributionConfig?.DefaultCacheBehavior as any;

      inventory.push({
        uniqueKey: `AWS-${account.id}-CLOUDFRONT-${distSummary.Id}`,
        provider: "AWS",
        accountName: account.name,
        accountId: account.id,
        service: "CloudFront",
        name: distSummary.DomainName || "N/A",
        id: distSummary.Id || "N/A",
        host: distSummary.DomainName || "N/A",
        status: distSummary.Enabled ? "Enabled" : "Disabled",
        operatingSystem: dist.DistributionConfig?.PriceClass || "N/A",
        platform: dist.DistributionConfig?.HttpVersion || "http2and3",
        architecture:
          dist.DistributionConfig?.ViewerCertificate?.SSLSupportMethod || "N/A",
        instanceType: dist.DistributionConfig?.DefaultRootObject || "N/A",
        tags,
        raw: {
          arn: distSummary.ARN,
          domainName: distSummary.DomainName,
          aliases: dist.DistributionConfig?.Aliases?.Items || [],
          origins: dist.DistributionConfig?.Origins?.Items || [],
          defaultCacheBehavior: {
            targetOriginId:
              defaultCacheBehavior?.TargetOriginId,
            viewerProtocolPolicy:
              defaultCacheBehavior?.ViewerProtocolPolicy,
            minTTL: defaultCacheBehavior?.MinTTL,
            allowedMethods:
              defaultCacheBehavior?.AllowedMethods?.Items || [],
            cachedMethods:
              defaultCacheBehavior?.CachedMethods?.Items ||
              defaultCacheBehavior?.AllowedMethods?.CachedMethods?.Items ||
              [],
          },
          viewerCertificate: dist.DistributionConfig?.ViewerCertificate,
          logging: dist.DistributionConfig?.Logging?.Enabled,
          geoRestriction:
            distributionConfig?.Restrictions?.GeoRestriction?.RestrictionType,
          priceClass: dist.DistributionConfig?.PriceClass,
          webACLId: dist.DistributionConfig?.WebACLId,
          comment: dist.DistributionConfig?.Comment,
          createdTime: dist.LastModifiedTime,
          lastModifiedTime: dist.LastModifiedTime,
        },
      });
    }

    return inventory;
  } catch (error: any) {
    console.error("AWS CloudFront ERROR:", error?.message || error);
    return [];
  }
}
