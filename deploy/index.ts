/* eslint-disable @typescript-eslint/no-var-requires */

import 'source-map-support/register';
import { App, CfnOutput } from '@aws-cdk/core';
import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';

const deployConfig = require('./config')();

const cacclDeployVersion = process.env.CACCL_DEPLOY_VERSION || '';
const stackName = `CacclDeploy-${deployConfig.appName}`;

const stackProps: CacclDeployStackProps = {
  stackName,
  vpcId: deployConfig.vpcId,
  cidrBlock: deployConfig.cidrBlock,
  maxAzs: deployConfig.maxAzs || 2,
  certificateArn: deployConfig.certificateArn,
  ecsClusterName: deployConfig.ecsClusterName,
  appEnvironment: deployConfig.appEnvironment || {},
  notifications: deployConfig.notifications || {},
  loadBalancerLogBucket: deployConfig.loadBalancerLogBucket,
  taskDefProps: {
    appImage: deployConfig.appImage || {},
    proxyImage: deployConfig.proxyImage,
    taskCpu: deployConfig.taskCpu,
    taskMemoryLimit: deployConfig.taskMemoryLimit,
    logRetentionDays: deployConfig.logRetentionDays,
    gitRepoVolume: deployConfig.gitRepoVolume,
  },
  taskCount: deployConfig.taskCount || 1,
  tags: {
    caccl_deploy_version: cacclDeployVersion,
    caccl_deploy_stack_name: stackName,
    ...deployConfig.tags,
  },
  env: {
    account: deployConfig.awsAccountId || process.env.AWS_ACCOUNT_ID,
    region: deployConfig.awsRegion || process.env.AWS_REGION,
  },
};

if (deployConfig.docDb) {
  stackProps.docDbOptions = {
    instanceType: deployConfig.docDbInstanceType || 'r5.large',
    instanceCount: deployConfig.docDbInstanceCount || 1,
  };
}

const app = new App();
const stack = new CacclDeployStack(app, stackName, stackProps);

new CfnOutput(stack, 'CacclDeployVersion', {
  exportName: `${stackName}-caccl-deploy-version`,
  value: cacclDeployVersion,
});

app.synth();
