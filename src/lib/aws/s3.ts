import {

  S3Client,
  ListBucketsCommand,
  GetBucketTaggingCommand,
  GetBucketLocationCommand

} from "@aws-sdk/client-s3";

import {

  formatAwsTags

} from "./tags";

import type {

  AWSAccount

} from "./accounts";

const region =
  process.env.AWS_REGION || "us-east-1";

export async function getAWSS3Inventory(

  account: AWSAccount

) {

  const credentials = {

    accessKeyId:
      account.accessKeyId,

    secretAccessKey:
      account.secretAccessKey

  };

  const client =
    new S3Client({

      region,
      credentials

    });

  const data =
    await client.send(

      new ListBucketsCommand({})

    );

  return await Promise.all(

    (data.Buckets || []).map(

      async (bucket) => {

        const id =
          bucket.Name || "";

        let bucketRegion = region;

        try {

          const locData =
            await client.send(

              new GetBucketLocationCommand({

                Bucket: id

              })

            );

          bucketRegion =
            locData.LocationConstraint ||
            "us-east-1";

        } catch {

          bucketRegion = region;

        }

        let tags = {};

        try {

          const tagData =
            await client.send(

              new GetBucketTaggingCommand({

                Bucket: id

              })

            );

          tags =
            formatAwsTags(
              tagData.TagSet
            );

        } catch {

          tags = {};

        }

        return {

          uniqueKey:
            `AWS-${account.id}-S3-${id}`,

          provider:
            "AWS",

          accountName:
            account.name,

          accountId:
            account.id,

          service:
            "S3",

          name:
            id,

          operatingSystem:
            "N/A",

          id,

          host:
            `s3.${bucketRegion}.amazonaws.com`,

          status:
            "available",

          availabilityZone:
            bucketRegion,

          tags

        };

      }

    )

  );

}