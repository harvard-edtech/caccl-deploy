/* eslint-disable @typescript-eslint/no-var-requires */

import 'source-map-support/register';
import { App, CfnOutput } from '@aws-cdk/core';
import { CacclDeployStack, CacclDeployStackProps } from './lib/stack';
import DeployConfig from '../lib/deployConfig';

const cacclDeployVersion = process.env.CACCL_DEPLOY_VERSION || '';
const appPrefix = process.env.CACCL_DEPLOY_APP_PREFIX || '';
const appName = process.env.CACCL_DEPLOY_APP_NAME;
const stackName = `CacclDeploy-${appName}`;

console.log(appPrefix, appName, stackName);

DeployConfig.fromSsmParams(appPrefix, false)
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
        account: deployConfig.awsAccountId || process.env.AWS_ACCOUNT_ID,
        region: deployConfig.awsRegion || process.env.AWS_REGION,
      },
    };

    if (deployConfig.docDb) {
      stackProps.docDbOptions = {
        instanceType: deployConfig.docDbInstanceType || 'r5.large',
        instanceCount: deployConfig.docDbInstanceCount || 1,
        profiler: deployConfig.docDbProfiler || false,
      };
    }

    console.log(stackProps);

    const app = new App();
    const stack = new CacclDeployStack(app, stackName, stackProps);

    new CfnOutput(stack, 'CacclDeployVersion', {
      exportName: `${stackName}-caccl-deploy-version`,
      value: cacclDeployVersion,
    });

    app.synth();
  })
  .catch((err) => {
    console.log(err);
  });
