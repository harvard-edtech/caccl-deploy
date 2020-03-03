import * as fs from 'fs';
import * as path from 'path';
import { Construct, Stack } from '@aws-cdk/core';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';
import { LogGroup } from '@aws-cdk/aws-logs';
import {
  Cluster,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  ContainerImage,
  ContainerDefinition,
  IEcsLoadBalancerTarget
} from '@aws-cdk/aws-ecs';

export interface EcsProps {
  readonly vpc: Vpc,
  readonly securityGroup: SecurityGroup,
  readonly taskCpu: number,
  readonly taskMemoryLimit: number,
  readonly appName: string,
  readonly appImage?: string;
  readonly appBuildPath?: string;
  readonly appEnvironment?: { [key: string]: string },
  readonly proxyImage?: string,
  readonly proxyEnvironment?: { [key: string]: string },
  readonly logRetentionDays: number;
};

export class EcsConstruct extends Construct {

  readonly loadBalancerTarget: IEcsLoadBalancerTarget;

  constructor(scope: Construct, id: string, props: EcsProps) {
    super(scope, id);

    const {
      vpc,
      securityGroup,
      taskCpu,
      taskMemoryLimit,
      appName,
      appImage,
      appBuildPath,
      appEnvironment = {},
      proxyImage = 'hdce/nginx-ssl-proxy',
      proxyEnvironment = {},
      logRetentionDays,
    } = props;

    const cluster = new Cluster(this, 'EcsCluster', {
      vpc,
      containerInsights: true,
    });

    const taskDef = new FargateTaskDefinition(this, 'Task', {
      cpu: taskCpu,
      memoryLimitMiB: taskMemoryLimit,
    });

    // create a log group for the containers
    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `/${Stack.of(this).stackName}-logs`,
      retention: logRetentionDays,
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
          repositoryName: `${Stack.of(this).stackName}-app`,
        })
      );
    } else {
      console.log('Either `appImage` or `appBuildPath` must be defined');
      process.exit(1);
    }

    appEnvironment.PORT = '8080';
    appEnvironment.NODE_ENV = 'production';

    // this container gets our app
    const appContainer = new ContainerDefinition(this, 'AppContainer', {
      image: appContainerImage,
      taskDefinition: taskDef,
      essential: true,
      environment: appEnvironment,
      logging: LogDriver.awsLogs({
        streamPrefix: 'app',
        logGroup,
      }),
    });

    appContainer.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
    });

    proxyEnvironment.APP_PORT = '8080';

    // this container is the proxy
    const proxyContainer = new ContainerDefinition(this, 'ProxyContainer', {
      image: ContainerImage.fromRegistry(proxyImage),
      environment: proxyEnvironment,
      essential: true,
      taskDefinition: taskDef,
      logging: LogDriver.awsLogs({
        streamPrefix: 'proxy',
        logGroup,
      }),
    });

    proxyContainer.addPortMappings({
      containerPort: 443,
      hostPort: 443,
    });

		const service = new FargateService(this, 'FargateService', {
			cluster,
			securityGroup,
			taskDefinition: taskDef,
			minHealthyPercent: 100,
			maxHealthyPercent: 200,
			serviceName: `${Stack.of(this).stackName}-service`,
		});

    // this is the thing that gets handed off to the load balancer
    this.loadBalancerTarget = service.loadBalancerTarget({
      containerName: proxyContainer.containerName,
      containerPort: 443,
    });
  }
};
