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

          const [

            ec2,
            rds,
            s3,
            vpc,
            subnet,
            elb,
            ecs,
            cloudfront,
            dynamodb,
            documentdb,
            lambda,
            eks,
            elasticache,
            apigateway

          ] = await Promise.all([

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

          return [

            ...ec2,
            ...rds,
            ...s3,
            ...vpc,
            ...subnet,
            ...elb,
            ...ecs,
            ...cloudfront,
            ...dynamodb,
            ...documentdb,
            ...lambda,
            ...eks,
            ...elasticache,
            ...apigateway

          ];

        }
      )

    );

  return accountResults.flat();

}