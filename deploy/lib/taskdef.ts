import { Construct, Stack, RemovalPolicy } from '@aws-cdk/core';
import { LogGroup } from '@aws-cdk/aws-logs';
import { FargateTaskDefinition, LogDriver, ContainerDefinition } from '@aws-cdk/aws-ecs';
import { CacclContainerImageOptions, CacclContainerImage } from './image';
import { CacclGitRepoVolumeContainer } from './volumeContainer';
import { CacclAppEnvironment } from './appEnvironment';

const DEFAULT_PROXY_REPO_NAME = 'hdce/nginx-ssl-proxy';

export interface CacclTaskDefProps {
  appImage: CacclContainerImageOptions;
  proxyImage?: CacclContainerImageOptions;
  vpcCidrBlock?: string;
  appEnvironment?: CacclAppEnvironment;
  taskCpu?: number;
  taskMemoryLimit?: number;
  logRetentionDays?: number;
  gitRepoVolume?: { [key: string]: string };
}

export class CacclTaskDef extends Construct {
  taskDef: FargateTaskDefinition;
  proxyContainer: ContainerDefinition;
  appContainer: ContainerDefinition;
  logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: CacclTaskDefProps) {
    super(scope, id);

    const {
      appImage,
      proxyImage = { repoName: DEFAULT_PROXY_REPO_NAME },
      appEnvironment,
      taskCpu = 256,
      taskMemoryLimit = 512,
      logRetentionDays = 90,
    } = props;

    this.taskDef = new FargateTaskDefinition(this, 'Task', {
      cpu: taskCpu,
      memoryLimitMiB: taskMemoryLimit,
    });

    // create a log group for the containers
    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `/${Stack.of(this).stackName}-logs`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logRetentionDays,
    });

    const appContainerImage = new CacclContainerImage(this, 'AppImage', appImage);

    // this container gets our app
    this.appContainer = new ContainerDefinition(this, 'AppContainer', {
      image: appContainerImage.image,
      taskDefinition: this.taskDef,
      essential: true,
      environment: appEnvironment?.env,
      secrets: appEnvironment?.secrets,
      logging: LogDriver.awsLogs({
        streamPrefix: 'app',
        logGroup,
      }),
    });

    this.appContainer.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
    });

    const proxyContainerImage = new CacclContainerImage(this, 'ProxyImage', proxyImage);

    const environment: { [key: string]: string } = {
      APP_PORT: '8080',
    };

    /**
     * this should never be undefined at this point but we have flag it
     * as '?' and wrap in a undefined check as
     * because of how the value can't come with the
     * rest of the task def configuration
     */
    if (props.vpcCidrBlock !== undefined) {
      environment.VPC_CIDR = props.vpcCidrBlock;
    } else {
      throw new Error('proxy contianer environment needs the vpc cidr!');
    }

    // this container is the proxy
    this.proxyContainer = new ContainerDefinition(this, 'ProxyContainer', {
      image: proxyContainerImage.image,
      environment,
      essential: true,
      taskDefinition: this.taskDef,
      logging: LogDriver.awsLogs({
        streamPrefix: 'proxy',
        logGroup,
      }),
    });

    this.proxyContainer.addPortMappings({
      containerPort: 443,
      hostPort: 443,
    });

    /**
     * for edge cases where we have some data in a git repo that we want to make available to the app.
     * this adds a third container to the task definition that uses an alpine/git image to clone
     * a repo into a configured mount point. the repo can be private, in which case the url would need
     * to include the user:pass info, therefore the repo url value has to come from secrets manager
     */
    if (props.gitRepoVolume) {
      const { repoUrlSecretArn, appContainerPath } = props.gitRepoVolume;

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
        repoUrlSecretArn,
        appContainerPath,
        cacclTaskDef: this,
      });
    }
    this.logGroup = logGroup;
  }
}
