/* eslint-disable camelcase */
import { App, CfnOutput } from 'aws-cdk-lib';
import { readFileSync } from 'node:fs';
import 'source-map-support/register';
import yn from 'yn';

import {
  type CacclDeployStackProps,
  CacclDeployStackPropsData,
} from '../types/index.js';
import CacclDeployStack from './lib/classes/CacclDeployStack.js';

if (process.env.CDK_STACK_PROPS_FILE_PATH === undefined) {
  throw new Error('CDK_STACK_PROPS_FILE_PATH not found.');
}

const stackPropsData: CacclDeployStackPropsData =
  CacclDeployStackPropsData.parse(
    JSON.parse(readFileSync(process.env.CDK_STACK_PROPS_FILE_PATH, 'utf8')),
  );

const {
  albLogBucketName,
  awsAccountId,
  awsRegion,
  cacclDeployVersion,
  deployConfig,
  deployConfigHash,
  ecsClusterName,
  stackName,
  vpcId,
} = stackPropsData;

const stackProps: CacclDeployStackProps = {
  // shared s3 bucket where the application load balancer logs will end up
  albLogBucketName,
  // object that defines the environment variables that will be injected into the app container
  appEnvironment: deployConfig.appEnvironment ?? {},
  // add an elasticache/redis instance (e.g. for use by django)
  cacheOptions: deployConfig.cacheOptions,
  // ARN of the ssl certificate
  certificateArn: deployConfig.certificateArn,
  // settings for a database
  dbOptions: deployConfig.dbOptions,
  // name of the shared ECS cluster we're deploying to
  ecsClusterName,
  enableExecuteCommand: yn(deployConfig.enableExecuteCommand),
  env: {
    account: awsAccountId,
    region: awsRegion,
  },
  // optionally attach a restrictive security group
  firewallSgId: deployConfig.firewallSgId,
  // settings for the load balancer & load balancer targets
  lbOptions: deployConfig.lbOptions,
  // email and slack endpoints
  notifications: deployConfig.notifications ?? {},
  // settings to run tasks like cronjobs
  scheduledTasks: deployConfig.scheduledTasks,
  // the CloudFormation stack name, e.g. "CacclDeploy-foo-app"
  stackName,
  tags: {
    caccl_deploy_stack_name: stackName,
    ...deployConfig.tags,
  },
  // how many concurrent tasks to run
  taskCount: Number(deployConfig.taskCount ?? 1),
  // settings for the fargate task
  taskDefProps: {
    appImage: deployConfig.appImage,
    gitRepoVolume: deployConfig.gitRepoVolume,
    logRetentionDays: deployConfig.logRetentionDays,
    proxyImage: deployConfig.proxyImage,
    taskCpu: deployConfig.taskCpu,
    taskMemory: deployConfig.taskMemory,
  },
  // id of the shared vpc we're deploying to
  vpcId,
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
