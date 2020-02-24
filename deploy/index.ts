#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { CacclAppStack } from './lib/stack';

const deployConfig = require('./config')();
const appStackName = `${deployConfig.appName}-app`;

const app = new App();

const appStack = new CacclAppStack(app, appStackName, {
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

app.synth();
