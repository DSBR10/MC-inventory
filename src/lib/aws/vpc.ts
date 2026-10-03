import {

  EC2Client,
  DescribeVpcsCommand

} from "@aws-sdk/client-ec2";

import {

  formatAwsTags

} from "./tags";

import type {

  AWSAccount

} from "./accounts";

export async function getAWSVPCInventory(

  account: AWSAccount

) {

  const credentials = {

    accessKeyId:
      account.accessKeyId,

    secretAccessKey:
      account.secretAccessKey

  };

  const client =
    new EC2Client({

      region: account.region,
      credentials

    });

  const data =
    await client.send(

      new DescribeVpcsCommand({})

    );

  return (data.Vpcs || []).map((vpc) => {

    const id =
      vpc.VpcId || "";

    return {

      uniqueKey:
        `AWS-${account.id}-VPC-${id}`,

      provider:
        "AWS",

      accountName:
        account.name,

      accountId:
        account.id,

      service:
        "VPC",

      name:
        vpc.Tags?.find(

          (t) => t.Key === "Name"

        )?.Value || "N/A",

      operatingSystem:
        "N/A",

      id,

      host:
        vpc.CidrBlock || "N/A",

      status:
        vpc.State || "UNKNOWN",

      tags:
        formatAwsTags(
          vpc.Tags
        )

    };

  });

}