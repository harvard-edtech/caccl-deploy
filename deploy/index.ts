#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';
import { CacclContainerImageOptions } from './lib/image';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deployConfig = require('./config')();
const stackName = `CacclDeploy-${deployConfig.appName}`

const stackProps: CacclDeployStackProps = {
  stackName,
	vpcId: deployConfig.vpcId,
	cidrBlock: deployConfig.cidrBlock,
	maxAzs: deployConfig.maxAzs,
	certificateArn: deployConfig.certificateArn,
	taskDefProps: {
    appImage: deployConfig.appImage || {},
    proxyImage: deployConfig.proxyImage,
		appEnvironment: deployConfig.appEnvironment,
		taskCpu: deployConfig.taskCpu,
		taskMemoryLimit: deployConfig.taskMemoryLimit,
		logRetentionDays: deployConfig.logRetentionDays,
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
const stack = new CacclDeployStack(app, stackName, stackProps);

app.synth();
