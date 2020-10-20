/* eslint-disable @typescript-eslint/no-var-requires */

import 'source-map-support/register';
import { App, CfnOutput } from '@aws-cdk/core';
import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';
import DeployConfig from '../lib/deployConfig';

[
  'CACCL_DEPLOY_VERSION',
  'CACCL_DEPLOY_SSM_APP_PREFIX',
  'CACCL_DEPLOY_STACK_NAME_PREFIX',
  'CACCL_DEPLOY_APP_NAME',
  'AWS_ACCOUNT_ID',
  'AWS_REGION',
].forEach((envVar) => {
  if (process.env[envVar] === undefined) {
    console.error(`CDK operation missing ${envVar}`);
    process.exit(1);
  }
});

const cacclDeployVersion = process.env.CACCL_DEPLOY_VERSION;
const ssmAppPrefix = process.env.CACCL_DEPLOY_SSM_APP_PREFIX;
const stackNamePrefix = process.env.CACCL_DEPLOY_STACK_NAME_PREFIX;
const appName = process.env.CACCL_DEPLOY_APP_NAME;
const stackName = `${stackNamePrefix}${appName}`;

DeployConfig.fromSsmParams(ssmAppPrefix, false)
  .then((deployConfig) => {
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
        caccl_deploy_stack_name: stackName,
        ...deployConfig.tags,
      },
      env: {
        account: process.env.AWS_ACCOUNT_ID,
        region: process.env.AWS_REGION,
      },
    };

    if (deployConfig.docDb) {
      stackProps.docDbOptions = {
        instanceType: deployConfig.docDbInstanceType || 'r5.large',
        instanceCount: deployConfig.docDbInstanceCount || 1,
        profiler: deployConfig.docDbProfiler || false,
      };
    }

    const app = new App();
    const stack = new CacclDeployStack(app, stackName, stackProps);

    if (cacclDeployVersion !== undefined) {
      new CfnOutput(stack, 'CacclDeployVersion', {
        exportName: `${stackName}-caccl-deploy-version`,
        value: cacclDeployVersion,
      });
    }

    app.synth();
  })
  .catch((err) => {
    console.log(err);
  });
