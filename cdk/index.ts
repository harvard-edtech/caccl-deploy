/* eslint-disable @typescript-eslint/no-var-requires */

import 'source-map-support/register';
import { App, CfnOutput } from '@aws-cdk/core';
import { readFileSync } from 'fs';
const yn = require('yn');

import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';

if (process.env.CDK_STACK_PROPS_FILE_PATH === undefined) {
  throw new Error();
}

const stackPropsData = JSON.parse(
  readFileSync(process.env.CDK_STACK_PROPS_FILE_PATH, 'utf8')
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
  stackName,
  vpcId,
  ecsClusterName,
  albLogBucketName,
  cidrBlock: deployConfig.cidrBlock,
  maxAzs: deployConfig.maxAzs || 2,
  certificateArn: deployConfig.certificateArn,
  appEnvironment: deployConfig.appEnvironment || {},
  notifications: deployConfig.notifications || {},
  taskDefProps: {
    appImage: deployConfig.appImage,
    proxyImage: deployConfig.proxyImage,
    taskCpu: deployConfig.taskCpu,
    taskMemory: deployConfig.taskMemory,
    logRetentionDays: deployConfig.logRetentionDays,
    gitRepoVolume: deployConfig.gitRepoVolume,
  },
  taskCount: +(deployConfig.taskCount || 1),
  tags: {
    caccl_deploy_stack_name: stackName,
    ...deployConfig.tags,
  },
  env: {
    account: awsAccountId,
    region: awsRegion,
  },
};

if (yn(deployConfig.docDb)) {
  stackProps.docDbOptions = {
    instanceType: deployConfig.docDbInstanceType || 't3.medium',
    instanceCount: deployConfig.docDbInstanceCount || 1,
    profiler: yn(deployConfig.docDbProfiler),
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
