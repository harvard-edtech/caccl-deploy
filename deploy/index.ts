#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deployConfig = require('./config')();
const stackName = `CacclDeploy-${deployConfig.appName}`;

const stackProps: CacclDeployStackProps = {
  stackName,
  vpcId: deployConfig.vpcId,
  cidrBlock: deployConfig.cidrBlock,
  maxAzs: deployConfig.maxAzs,
  certificateArn: deployConfig.certificateArn,
  ecsClusterName: deployConfig.ecsClusterName,
  taskDefProps: {
    appImage: deployConfig.appImage || {},
    proxyImage: deployConfig.proxyImage,
    appEnvironment: deployConfig.appEnvironment,
    taskCpu: deployConfig.taskCpu,
    taskMemoryLimit: deployConfig.taskMemoryLimit,
    logRetentionDays: deployConfig.logRetentionDays,
    gitRepoVolume: deployConfig.gitRepoVolume,
  },
  taskCount: deployConfig.taskCount || 1,
  tags: deployConfig.tags,
  env: {
    account: deployConfig.awsAccountId,
    region: deployConfig.awsRegion,
  },
};

if (deployConfig.docDb) {
  stackProps.docDbOptions = {
    instanceType: deployConfig.docDbInstanceType || 'r5.large',
  };
}

console.log(stackProps);

const app = new App();
new CacclDeployStack(app, stackName, stackProps);

app.synth();
