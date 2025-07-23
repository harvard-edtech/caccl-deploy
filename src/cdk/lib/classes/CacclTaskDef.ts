// Import AWS CDK lib
import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  aws_ecs as ecs,
  aws_logs as logs,
} from 'aws-cdk-lib';
// Import AWS constructs
import { Construct } from 'constructs';

import { type CacclTaskDefProps } from '../../../types/index.js';
// Import constants
import DEFAULT_PROXY_REPO_NAME from '../constants/DEFAULT_PROXY_REPO_NAME.js';
import CacclContainerImage from './CacclContainerImage.js';
// Import shared types
import CacclGitRepoVolumeContainer from './CacclGitRepoVolumeContainer.js';

// Import classes

class CacclTaskDef extends Construct {
  appContainer: ecs.ContainerDefinition;

  appOnlyTaskDef: ecs.FargateTaskDefinition;

  logGroup!: logs.LogGroup;

  proxyContainer: ecs.ContainerDefinition;

  taskDef: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: CacclTaskDefProps) {
    super(scope, id);

    const {
      appEnvironment,
      appImage,
      gitRepoVolume,
      logRetentionDays = 90,
      proxyImage = `${DEFAULT_PROXY_REPO_NAME}:latest`,
      taskCpu = 256, // in cpu units; 256 == .25 vCPU
      taskMemory = 512, // in MiB
      vpcCidrBlock,
    } = props;

    const appContainerImage = new CacclContainerImage(this, 'AppImage', {
      appImage,
    });

    // this is the task def that our fargate service will run
    this.taskDef = new ecs.FargateTaskDefinition(this, 'Task', {
      cpu: taskCpu,
      memoryLimitMiB: taskMemory,
    });

    // this task def will have only the app container and be used for one-off tasks
    this.appOnlyTaskDef = new ecs.FargateTaskDefinition(this, 'AppOnlyTask', {
      cpu: taskCpu,
      memoryLimitMiB: taskMemory,
    });

    // params for the fargate service's app container
    const appContainerParams = {
      environment: appEnvironment?.env,
      essential: true,
      image: appContainerImage.image,
      logging: ecs.LogDriver.awsLogs({
        logGroup: new logs.LogGroup(this, 'AppLogGroup', {
          logGroupName: `/${Stack.of(this).stackName}/app`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: logRetentionDays,
        }),
        streamPrefix: 'app',
      }),
      secrets: appEnvironment?.secrets,
      taskDefinition: this.taskDef, // using the standard task def
    };

    // the container definition associated with our fargate service task def
    this.appContainer = new ecs.ContainerDefinition(
      this,
      'AppContainer',
      appContainerParams,
    );
    this.appContainer.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
    });

    // now create a copy of the container params but use the one-off app only task def
    const appOnlyContainerParams = {
      ...appContainerParams,
      taskDefinition: this.appOnlyTaskDef,
    };
    // and a 2nd container definition used by the one-off app only task deff
    new ecs.ContainerDefinition(
      this,
      'AppOnlyContainer',
      appOnlyContainerParams,
    );

    const proxyContainerImage = new CacclContainerImage(this, 'ProxyImage', {
      appImage: proxyImage,
    });

    const environment: { [key: string]: string } = {
      APP_PORT: '8080',
    };

    /**
     * this should never be undefined at this point but we have flag it
     * as '?' and wrap in a undefined check as
     * because of how the value can't come with the
     * rest of the task def configuration
     */
    if (vpcCidrBlock === undefined) {
      throw new Error('proxy contianer environment needs the vpc cidr!');
    } else {
      environment.VPC_CIDR = vpcCidrBlock;
    }

    // this container is the proxy
    this.proxyContainer = new ecs.ContainerDefinition(this, 'ProxyContainer', {
      environment,
      essential: true,
      image: proxyContainerImage.image,
      logging: ecs.LogDriver.awsLogs({
        logGroup: new logs.LogGroup(this, 'ProxyLogGroup', {
          logGroupName: `/${Stack.of(this).stackName}/proxy`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: logRetentionDays,
        }),
        streamPrefix: 'proxy',
      }),
      taskDefinition: this.taskDef,
    });

    this.proxyContainer.addPortMappings({
      containerPort: 443,
      hostPort: 443,
    });

    new CfnOutput(this, 'TaskDefinitionArn', {
      exportName: `${Stack.of(this).stackName}-task-def-name`,
      // "family" is synonymous with "name", or at least aws frequently treats it that way
      value: this.taskDef.family,
    });

    new CfnOutput(this, 'AppOnlyTaskDefinitionArn', {
      exportName: `${Stack.of(this).stackName}-app-only-task-def-name`,
      // "family" is synonymous with "name", or at least aws frequently treats it that way
      value: this.appOnlyTaskDef.family,
    });

    /**
     * for edge cases where we have some data in a git repo that we want to make available to the app.
     * this adds a third container to the task definition that uses an alpine/git image to clone
     * a repo into a configured mount point. the repo can be private, in which case the url would need
     * to include the user:pass info, therefore the repo url value has to come from secrets manager
     */
    if (gitRepoVolume) {
      const { appContainerPath, repoUrlSecretArn } = gitRepoVolume;

      if (repoUrlSecretArn === undefined) {
        throw new Error(
          'You must provide the ARN of a SecretsManager secret containing the git repo url as `deployConfig.gitRepoVolume.repoUrlSecretArn!`',
        );
      }

      if (appContainerPath === undefined) {
        throw new Error(
          'You must set `deployConfig.gitRepoVolume.appContainerPath` to the path you want the git repo volume to be mounted in your app',
        );
      }

      new CacclGitRepoVolumeContainer(this, 'VolumeContainer', {
        appContainer: this.appContainer,
        appContainerPath,
        repoUrlSecretArn,
        taskDefinition: this.taskDef,
      });
    }
  }
}

export default CacclTaskDef;
