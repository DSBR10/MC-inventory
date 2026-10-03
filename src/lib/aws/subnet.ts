import {

  EC2Client,
  DescribeSubnetsCommand

} from "@aws-sdk/client-ec2";

import {

  formatAwsTags

} from "./tags";

import type {

  AWSAccount

} from "./accounts";

export async function getAWSSubnetInventory(

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

      new DescribeSubnetsCommand({})

    );

  return (data.Subnets || []).map((subnet) => {

    const id =
      subnet.SubnetId || "";

    return {

      uniqueKey:
        `AWS-${account.id}-Subnet-${id}`,

      provider:
        "AWS",

      accountName:
        account.name,

      accountId:
        account.id,

      service:
        "Subnet",

      name:
        subnet.Tags?.find(

          (t) => t.Key === "Name"

        )?.Value || "N/A",

      operatingSystem:
        "N/A",

      id,

      host:
        subnet.CidrBlock || "N/A",

      status:
        subnet.State || "UNKNOWN",

      tags:
        formatAwsTags(
          subnet.Tags
        )

    };

  });

}