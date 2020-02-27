#!/usr/bin/env node
import 'source-map-support/register';
import { App, Tag } from '@aws-cdk/core';
import { CacclAppStack } from './lib/stack';

const deployConfig = require('./config')();
const appStackName = `${deployConfig.appName}-app`;

const app = new App();
const stack = new CacclAppStack(app, appStackName, {
  cidrBlock: deployConfig.cidrBlock,
  certificateArn: deployConfig.certificateArn,
  appImage: deployConfig.appImage,
  appName: deployConfig.appName,
  appHost: deployConfig.appHost,
  appEnvironment: deployConfig.appEnvironment,
  appBuildPath: deployConfig.appBuildPath || process.env.APP_BASE_DIR,
  proxyImage: deployConfig.proxyImage,
  proxyEnvironment: deployConfig.proxyEnvironment,
  taskCpu: deployConfig.taskCpu,
  taskMemoryLimit: deployConfig.taskMemoryLimit,
  logRetentionDays: deployConfig.logRetentionDays,
});

Tag.add(stack, 'Project', 'MH');
Tag.add(stack, 'OU', 'DE');
Tag.add(stack, 'CacclAppStack', appStackName);

app.synth();
