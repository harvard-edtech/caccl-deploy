import { Construct, Stack, RemovalPolicy } from '@aws-cdk/core';
import { LogGroup } from '@aws-cdk/aws-logs';
import { FargateTaskDefinition, LogDriver, ContainerDefinition } from '@aws-cdk/aws-ecs';
import { CacclContainerImageOptions, CacclContainerImage } from './image';

const DEFAULT_PROXY_REPO_NAME = 'hdce/nginx-ssl-proxy';

export interface CacclTaskDefProps {
  appImage: CacclContainerImageOptions,
  proxyImage?: CacclContainerImageOptions,
  appEnvironment?: { [key: string]: string };
  taskCpu?: number;
  taskMemoryLimit?: number;
  logRetentionDays?: number;
}

export class CacclTaskDef extends Construct {
  taskDef: FargateTaskDefinition;
  proxyContainer: ContainerDefinition;
  appContainer: ContainerDefinition;
  logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: CacclTaskDefProps) {
    super(scope, id);

    const {
      // if no app image options provided assume we need to build it
      appImage,
      proxyImage = { repoName: DEFAULT_PROXY_REPO_NAME },
      appEnvironment = {},
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

    appEnvironment.PORT = '8080';
    appEnvironment.NODE_ENV = 'production';

    // this container gets our app
    this.appContainer = new ContainerDefinition(this, 'AppContainer', {
      image: appContainerImage.image,
      taskDefinition: this.taskDef,
      essential: true,
      environment: appEnvironment,
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

    // this container is the proxy
    this.proxyContainer = new ContainerDefinition(this, 'ProxyContainer', {
      image: proxyContainerImage.image,
      environment: { APP_PORT: '8080' },
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

    this.logGroup = logGroup;
  }
}
