import {
  getAWSAccounts
} from "./accounts";

import {
  getAWSEC2Inventory
} from "./ec2";

import {
  getAWSRDSInventory
} from "./rds";

import {
  getAWSS3Inventory
} from "./s3";

import {
  getAWSVPCInventory
} from "./vpc";

import {
  getAWSSubnetInventory
} from "./subnet";

import {
  getAWSELBInventory
} from "./elb";

import {
  getAWSECSInventory
} from "./ecs";

import {
  getAWSCloudFrontInventory
} from "./cloudfront";

import {
  getAWSDynamoDBInventory
} from "./dynamodb";

import {
  getAWSDocumentDBInventory
} from "./documentdb";

import {
  getAWSLambdaInventory
} from "./lambda";

import {
  getAWSEKSInventory
} from "./eks";

import {
  getAWSElastiCacheInventory
} from "./elasticache";

import {
  getAWSAPIGatewayInventory
} from "./apigateway";

export async function getAWSInventory() {

  const accounts =
    getAWSAccounts();

  console.log(
    `AWS ACCOUNTS: ${accounts.length}`
  );

  const accountResults =
    await Promise.all(

      accounts.map(
        async (account) => {

          console.log(
            `Loading AWS account: ${account.name}`
          );

          const results = await Promise.allSettled([

            getAWSEC2Inventory(account),

            getAWSRDSInventory(account),

            getAWSS3Inventory(account),

            getAWSVPCInventory(account),

            getAWSSubnetInventory(account),

            getAWSELBInventory(account),

            getAWSECSInventory(account),

            getAWSCloudFrontInventory(account),

            getAWSDynamoDBInventory(account),

            getAWSDocumentDBInventory(account),

            getAWSLambdaInventory(account),

            getAWSEKSInventory(account),

            getAWSElastiCacheInventory(account),

            getAWSAPIGatewayInventory(account)

          ]);

          const getData = (r: PromiseSettledResult<any[]>, name: string) => {
            if (r.status === "fulfilled") return r.value || [];
            console.error(`AWS FETCH FAILED [${account.name}/${name}]:`, r.reason);
            return [];
          };

          return [

            ...getData(results[0], "EC2"),
            ...getData(results[1], "RDS"),
            ...getData(results[2], "S3"),
            ...getData(results[3], "VPC"),
            ...getData(results[4], "Subnet"),
            ...getData(results[5], "ELB"),
            ...getData(results[6], "ECS"),
            ...getData(results[7], "CloudFront"),
            ...getData(results[8], "DynamoDB"),
            ...getData(results[9], "DocumentDB"),
            ...getData(results[10], "Lambda"),
            ...getData(results[11], "EKS"),
            ...getData(results[12], "ElastiCache"),
            ...getData(results[13], "APIGateway")

          ];

        }
      )

    );

  return accountResults.flat();

}