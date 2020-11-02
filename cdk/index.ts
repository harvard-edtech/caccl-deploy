/* eslint-disable @typescript-eslint/no-var-requires */

import 'source-map-support/register';
import { App, CfnOutput } from '@aws-cdk/core';
import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';
import DeployConfig from '../lib/deployConfig';

[
  'CACCL_DEPLOY_VERSION',
  'CACCL_DEPLOY_SSM_APP_PREFIX',
  'CACCL_DEPLOY_STACK_NAME',
  'AWS_ACCOUNT_ID',
  'AWS_REGION',
].forEach((envVar) => {
  console.log(process.env[envVar]);
  if (process.env[envVar] === undefined || process.env[envVar] === '') {
    console.error(`CDK operation missing ${envVar}`);
    process.exit(1);
  }
});

const awsAccountId = process.env.AWS_ACCOUNT_ID;
const awsRegion = process.env.AWS_REGION;
const cacclDeployVersion = process.env.CACCL_DEPLOY_VERSION;
const ssmAppPrefix = process.env.CACCL_DEPLOY_SSM_APP_PREFIX;
const stackName = process.env.CACCL_DEPLOY_STACK_NAME || '';
const vpcId = process.env.CACCL_DEPLOY_VPC_ID;
const ecsClusterName = process.env.CACCL_DEPLOY_ECS_CLUSTER;

DeployConfig.fromSsmParams(ssmAppPrefix, false)
  .then((deployConfig) => {
    const stackProps: CacclDeployStackProps = {
      stackName,
      vpcId,
      ecsClusterName,
      cidrBlock: deployConfig.cidrBlock,
      maxAzs: deployConfig.maxAzs || 2,
      certificateArn: deployConfig.certificateArn,
      appEnvironment: deployConfig.appEnvironment || {},
      notifications: deployConfig.notifications || {},
      loadBalancerLogBucket: deployConfig.loadBalancerLogBucket,
      taskDefProps: {
        appImage: deployConfig.appImage,
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
        account: awsAccountId,
        region: awsRegion,
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
