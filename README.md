
This repo is about deploying spring boot app on AWS Fargate using AWS CDK.


## Get Started

##

```bash

#enable Cloudwatch Containers Insight
aws ecs put-account-setting-default --name containerInsights --value enabled --region <your region>

cd springboot-fargate-cdk
npm i

# npm install @aws-cdk/aws-ecs @aws-cdk/aws-ec2 @aws-cdk/aws-ecs-patterns @aws-cdk/aws-rds @aws-cdk/aws-secretsmanager
npm run build
npx cdk synth
npx cdk deploy 

```

## slides
aurora serverless -> https://aws.amazon.com/rds/aurora/serverless/
fargate sizing -> https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
