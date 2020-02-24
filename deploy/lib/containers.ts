import * as path from 'path';
import * as fs from 'fs';
import { Construct, Stack } from '@aws-cdk/core';
import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';
import {
  LogDriver,
  ContainerImage,
  ContainerDefinition,
  FargateTaskDefinition
} from '@aws-cdk/aws-ecs';


export interface ContainersProps {
  readonly taskDef: FargateTaskDefinition;
  readonly appImage?: string;
  readonly appBuildPath?: string;
  readonly appEnvironment?: { [key: string]: string },
  readonly proxyImage?: string,
  readonly proxyEnvironment?: { [key: string]: string },
  readonly logRetentionDays: number;
};

export class ContainersConstruct extends Construct {

  readonly appContainer: ContainerDefinition;
  readonly proxyContainer: ContainerDefinition;

  constructor(scope: Construct, id: string, props: ContainersProps) {
    super(scope, id);

    const {
      taskDef,
      appImage,
      appBuildPath,
      appEnvironment = {},
      proxyImage = 'hdce/nginx-ssl-proxy',
      proxyEnvironment = {},
      logRetentionDays,
    } = props;

    // both containers can use the same logging config
    const loggingConfig = LogDriver.awsLogs({
      streamPrefix: `/${Stack.of(this).stackName}`,
      logRetention: logRetentionDays,
    });

    let appContainerImage: ContainerImage;

    if (appImage !== undefined) {
      appContainerImage = ContainerImage.fromRegistry(appImage);
    } else if (appBuildPath !== undefined) {
      if (!fs.existsSync(path.join(appBuildPath, 'Dockerfile'))) {
        console.log(`No Dockerfile found at ${appBuildPath}`);
        process.exit(1);
      }
      appContainerImage = ContainerImage.fromDockerImageAsset(
        new DockerImageAsset(this, 'DockerImageAsset', {
          directory: appBuildPath,
        })
      );
    } else {
      console.log('Either `appImage` or `appBuildPath` must be defined');
      process.exit(1);
    }

    appEnvironment.PORT = '8080';
    appEnvironment.NODE_ENV = 'production';

    // this container gets our app
    this.appContainer = new ContainerDefinition(this, 'AppContainer', {
      image: appContainerImage,
      taskDefinition: taskDef,
      environment: appEnvironment,
      logging: loggingConfig,
    });

    this.appContainer.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
    });

    proxyEnvironment.APP_PORT = '8080';

    // this container is the proxy
    this.proxyContainer = new ContainerDefinition(this, 'ProxyContainer', {
      image: ContainerImage.fromRegistry(proxyImage),
      environment: proxyEnvironment,
      taskDefinition: taskDef,
      logging: loggingConfig,
    });

    this.proxyContainer.addPortMappings({
      containerPort: 443,
      hostPort: 443,
    });
  }
};
