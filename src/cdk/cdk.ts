/* eslint-disable @typescript-eslint/no-var-requires */

import 'source-map-support/register';
import { readFileSync } from 'fs';
import { App, CfnOutput } from 'aws-cdk-lib';
import yn from 'yn';

import CacclDeployStack from './lib/classes/CacclDeployStack.js';
import { CacclDeployStackProps, CacclDeployStackPropsData } from '../types/index.js';

if (process.env.CDK_STACK_PROPS_FILE_PATH === undefined) {
  throw new Error();
}

const stackPropsData: CacclDeployStackPropsData =
  CacclDeployStackPropsData.parse(
    JSON.parse(readFileSync(process.env.CDK_STACK_PROPS_FILE_PATH, 'utf8')),
  );

const {
  stackName,
  vpcId,
  ecsClusterName,
  awsRegion,
  awsAccountId,
  cacclDeployVersion,
  albLogBucketName,
  deployConfigHash,
  deployConfig,
} = stackPropsData;

const stackProps: CacclDeployStackProps = {
  // the CloudFormation stack name, e.g. "CacclDeploy-foo-app"
  stackName,
  // id of the shared vpc we're deploying to
  vpcId,
  // name of the shared ECS cluster we're deploying to
  ecsClusterName,
  // shared s3 bucket where the application load balancer logs will end up
  albLogBucketName,
  // ARN of the ssl certificate
  certificateArn: deployConfig.certificateArn,
  // object that defines the environment variables that will be injected into the app container
  appEnvironment: deployConfig.appEnvironment ?? {},
  // email and slack endpoints
  notifications: deployConfig.notifications ?? {},
  // settings for the fargate task
  taskDefProps: {
    appImage: deployConfig.appImage,
    proxyImage: deployConfig.proxyImage,
    taskCpu: deployConfig.taskCpu,
    taskMemory: deployConfig.taskMemory,
    logRetentionDays: deployConfig.logRetentionDays,
    gitRepoVolume: deployConfig.gitRepoVolume,
  },
  // how many concurrent tasks to run
  taskCount: +(deployConfig.taskCount ?? 1),
  // settings for the load balancer & load balancer targets
  lbOptions: deployConfig.lbOptions,
  // optionally attach a restrictive security group
  firewallSgId: deployConfig.firewallSgId,
  // add an elasticache/redis instance (e.g. for use by django)
  cacheOptions: deployConfig.cacheOptions,
  // settings for a database
  dbOptions: deployConfig.dbOptions,
  // settings to run tasks like cronjobs
  scheduledTasks: deployConfig.scheduledTasks,
  enableExecuteCommand: yn(deployConfig.enableExecuteCommand),
  tags: {
    caccl_deploy_stack_name: stackName,
    ...deployConfig.tags,
  },
  env: {
    account: awsAccountId,
    region: awsRegion,
  },
};

/**
 * docDb config backwards compatibility
 */
if (yn(deployConfig.docDb)) {
  stackProps.dbOptions = {
    engine: 'docdb',
    instanceCount: deployConfig.docDbInstanceCount,
    instanceType: deployConfig.docDbInstanceType,
    profiler: deployConfig.docDbProfiler,
  };
}

const app = new App();
const stack = new CacclDeployStack(app, stackName, stackProps);

new CfnOutput(stack, 'DeployConfigHash', {
  exportName: `${stackName}-deploy-config-hash`,
  value: deployConfigHash,
});

new CfnOutput(stack, 'CacclDeployVersion', {
  exportName: `${stackName}-caccl-deploy-version`,
  value: cacclDeployVersion,
});

app.synth();
