import {

  ElasticLoadBalancingV2Client,

  DescribeLoadBalancersCommand,
  DescribeListenersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  DescribeTagsCommand

} from "@aws-sdk/client-elastic-load-balancing-v2";

import {

  EC2Client,
  DescribeSecurityGroupsCommand

} from "@aws-sdk/client-ec2";

import type {

  AWSAccount

} from "./accounts";

import {

  formatAwsTags

} from "./tags";

const region =
  process.env.AWS_REGION || "us-east-1";

export async function getAWSELBInventory(

  account: AWSAccount

) {

  const credentials = {

    accessKeyId:
      account.accessKeyId,

    secretAccessKey:
      account.secretAccessKey

  };

  const client =
    new ElasticLoadBalancingV2Client({

      region,
      credentials

    });

  const ec2Client =
    new EC2Client({

      region,
      credentials

    });

  /* ───────────────────────────── */
  /* SECURITY GROUP MAP */
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
  /* LOAD BALANCERS */
  /* ───────────────────────────── */

  const data =
    await client.send(

      new DescribeLoadBalancersCommand({})

    );

  const loadBalancers =
    data.LoadBalancers || [];

  return await Promise.all(

    loadBalancers.map(async (lb) => {

      const arn =
        lb.LoadBalancerArn || "";

      const name =
        lb.LoadBalancerName || "N/A";

      /* ───────────────────────────── */
      /* TAGS */
      /* ───────────────────────────── */

      let tags = {};

      try {

        const tagsData =
          await client.send(

            new DescribeTagsCommand({

              ResourceArns: [arn]

            })

          );

        tags =
          formatAwsTags(

            tagsData.TagDescriptions?.[0]?.Tags

          );

      } catch {

        tags = {};

      }

      /* ───────────────────────────── */
      /* LISTENERS */
      /* ───────────────────────────── */

      let listeners: any[] = [];

      try {

        const listenersData =
          await client.send(

            new DescribeListenersCommand({

              LoadBalancerArn: arn

            })

          );

        listeners =
          (listenersData.Listeners || []).map((l) => ({

            name:
              `${l.Protocol}-${l.Port}`,

            protocol:
              l.Protocol,

            port:
              l.Port,

            arn:
              l.ListenerArn

          }));

      } catch {

        listeners = [];

      }

      /* ───────────────────────────── */
      /* TARGET GROUPS */
      /* ───────────────────────────── */

      let targetGroups: any[] = [];

      try {

        const tgData =
          await client.send(

            new DescribeTargetGroupsCommand({

              LoadBalancerArn: arn

            })

          );

        targetGroups =
          await Promise.all(

            (tgData.TargetGroups || []).map(

              async (tg) => {

                let targets: any[] = [];

                try {

                  const healthData =
                    await client.send(

                      new DescribeTargetHealthCommand({

                        TargetGroupArn:
                          tg.TargetGroupArn

                      })

                    );

                  targets =

                    (healthData.TargetHealthDescriptions || []).map(

                      (target) => ({

                        id:
                          target.Target?.Id,

                        port:
                          target.Target?.Port,

                        health:
                          target.TargetHealth?.State

                      })

                    );

                } catch {

                  targets = [];

                }

                return {

                  name:
                    tg.TargetGroupName,

                  protocol:
                    tg.Protocol,

                  port:
                    tg.Port,

                  targetType:
                    tg.TargetType,

                  targets

                };

              }

            )

          );

      } catch {

        targetGroups = [];

      }

      return {

        uniqueKey:
          `AWS-${account.id}-ELB-${name}`,

        provider:
          "AWS",

        accountName:
          account.name,

        accountId:
          account.id,

        service:
          "ELB",

        name,

        id:
          arn,

        host:
          lb.DNSName || "N/A",

        status:
          "available",

        operatingSystem:
          lb.Type || "N/A",

        vpcId:
          lb.VpcId || "N/A",

        availabilityZone:

          lb.AvailabilityZones?.map(

            (az) => az.ZoneName

          ).join(", "),

        securityGroups:

          (lb.SecurityGroups || [])
            .map((sg) =>
              sgMap.get(sg)
            )
            .filter(Boolean),

        listeners,

        targetGroups,

        tags,

        raw: lb

      };

    })

  );

}