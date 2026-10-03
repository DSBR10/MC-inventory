import {

  EC2Client,

  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand

} from "@aws-sdk/client-ec2";

import {

  SSMClient,
  DescribeInstanceInformationCommand

} from "@aws-sdk/client-ssm";

import {

  formatAwsTags

} from "./tags";

import type {

  AWSAccount

} from "./accounts";

export async function getAWSEC2Inventory(

  account: AWSAccount

) {

  const credentials = {

    accessKeyId:
      account.accessKeyId,

    secretAccessKey:
      account.secretAccessKey

  };

  const ec2Client =
    new EC2Client({

      region: account.region,
      credentials

    });

  const ssmClient =
    new SSMClient({

      region: account.region,
      credentials

    });

  /* ───────────────────────────── */
  /* SECURITY GROUPS */
  /* ───────────────────────────── */

  const sgData =
    await ec2Client.send(

      new DescribeSecurityGroupsCommand({})

    );

  const sgMap =
    new Map();

  for (const sg of (sgData.SecurityGroups || [])) {

    sgMap.set(

      sg.GroupId,

      {

        id:
          sg.GroupId || "N/A",

        name:
          sg.GroupName || "N/A",

        inboundRules:

          (sg.IpPermissions || []).flatMap((rule) =>

            (rule.IpRanges || []).map((range) => ({

              protocol:
                rule.IpProtocol,

              fromPort:
                rule.FromPort,

              toPort:
                rule.ToPort,

              cidr:
                range.CidrIp,

              direction:
                "inbound"

            }))

          ),

        outboundRules:

          (sg.IpPermissionsEgress || []).flatMap((rule) =>

            (rule.IpRanges || []).map((range) => ({

              protocol:
                rule.IpProtocol,

              fromPort:
                rule.FromPort,

              toPort:
                rule.ToPort,

              cidr:
                range.CidrIp,

              direction:
                "outbound"

            }))

          )

      }

    );

  }

  /* ───────────────────────────── */
  /* SSM MANAGED INSTANCES */
  /* ───────────────────────────── */

  const ssmData =
    await ssmClient.send(

      new DescribeInstanceInformationCommand({})

    );

  const managedInstances =
    new Set(

      (ssmData.InstanceInformationList || []).map(

        (i) => i.InstanceId

      )

    );

  /* ───────────────────────────── */
  /* EC2 */
  /* ───────────────────────────── */

  const data =
    await ec2Client.send(

      new DescribeInstancesCommand({})

    );

  const inventory: any[] = [];

  data.Reservations?.forEach((reservation) => {

    reservation.Instances?.forEach((instance) => {

      const id =
        instance.InstanceId || "";

      inventory.push({

        uniqueKey:
          `AWS-${account.id}-EC2-${id}`,

        provider:
          "AWS",

        accountName:
          account.name,

        accountId:
          account.id,

        service:
          "EC2",

        name:
          instance.Tags?.find(

            (t) => t.Key === "Name"

          )?.Value || "N/A",

        id,

        host:
          instance.PrivateIpAddress || "N/A",

        privateIp:
          instance.PrivateIpAddress || "N/A",

        publicIp:
          instance.PublicIpAddress || "N/A",

        status:
          instance.State?.Name || "UNKNOWN",

        operatingSystem:
          instance.PlatformDetails || "Linux/Unix",

        platform:
          instance.PlatformDetails || "Linux/Unix",

        architecture:
          instance.Architecture || "N/A",

        imageId:
          instance.ImageId || "N/A",

        instanceType:
          instance.InstanceType || "N/A",

        vpcId:
          instance.VpcId || "N/A",

        subnetId:
          instance.SubnetId || "N/A",

        availabilityZone:
          instance.Placement?.AvailabilityZone || "N/A",

        launchTime:
          instance.LaunchTime?.toISOString() || "N/A",

        ssmManaged:
          managedInstances.has(id),

        securityGroups:

          (instance.SecurityGroups || []).map((sg) =>

            sgMap.get(
              sg.GroupId
            )

          ).filter(Boolean),

        tags:
          formatAwsTags(
            instance.Tags
          )

      });

    });

  });

  return inventory;

}