import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { CfnDBInstance } from 'aws-cdk-lib/aws-rds';

export class SpringbootFargateCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Our VPC
    const vpc = new ec2.Vpc(this, "springboot-vpc", {
      maxAzs: 2,
      natGateways: 1
    });

    // Our ECS Fargate Cluster in this VPC
    const springbootEcsCluster = new ecs.Cluster(this, "springboot-ecs", {
      vpc,
      clusterName: "springbootCluster"
    });

    // Our Database - Aurora (no Serverless)
    const mySQLPassword = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: "SpringbootDB-DBPassword",
      generateSecretString: {
        excludePunctuation: true
      }
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'dbsg', {
      vpc,
      description: "springboot app database security group"
    });

    dbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306));

    const auroraDbInstance = new CfnDBInstance(this, "aurora-db-instance", {
      engine: "aurora",
      engineVersion: "5.7.mysql_aurora.2.11.4",
      dbInstanceClass: "db.r5.large", // Clase optimizada para memoria
      dbSubnetGroupName: "default",
      dbName: "notes_app",
      masterUsername: "dbaadmin",
      publiclyAccessible: true,
      masterUserPassword: mySQLPassword.secretValue.toString(),
      vpcSecurityGroups: [dbSecurityGroup.securityGroupId],
    });

    // Our application in AWS Fargate + ALB
    const springbootApp = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'springboot app svc', {
      cluster: springbootEcsCluster,
      desiredCount: 1,
      cpu: 256,
      memoryLimitMiB: 512,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('./springboot-app'),
        containerPort: 8080,
        environment: {
          'springdatasourceurl': `jdbc:mysql://${auroraDbInstance.attrEndpointAddress}:3306/notes_app?autoReconnect=true&useUnicode=true&characterEncoding=UTF-8&allowMultiQueries=true`,
          'springdatasourceusername': 'dbaadmin'
        },
        secrets: {
          'mysqlpassword': ecs.Secret.fromSecretsManager(mySQLPassword)
        }
      }
    });

    // Customize health check on ALB
    springbootApp.targetGroup.configureHealthCheck({
      "port": 'traffic-port',
      "path": '/',
      "interval": cdk.Duration.seconds(5),
      "timeout": cdk.Duration.seconds(4),
      "healthyThresholdCount": 2,
      "unhealthyThresholdCount": 2,
      "healthyHttpCodes": "200,301,302"
    });

    // Autoscaling - CPU
    const springbootAutoScaling = springbootApp.service.autoScaleTaskCount({
      maxCapacity: 6,
      minCapacity: 1
    });

    springbootAutoScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 45,
      policyName: "cpu autoscaling",
      scaleInCooldown: cdk.Duration.seconds(30),
      scaleOutCooldown: cdk.Duration.seconds(30)
    });
  }
}
