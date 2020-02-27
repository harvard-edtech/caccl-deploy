import * as fs from 'fs';
import * as path from 'path';
import { Stack, StackProps, Construct, Duration } from '@aws-cdk/core';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { StringParameter } from '@aws-cdk/aws-ssm';
import {
  FargateTaskDefinition,
  FargateService,
  ContainerDefinition,
  ContainerImage,
  LogDriver,
  Secret as EcsSecret,
  Cluster,
} from '@aws-cdk/aws-ecs';
import {
  TargetType,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ApplicationListener,
} from '@aws-cdk/aws-elasticloadbalancingv2';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';
import { VpcConstruct } from './vpc';
import { ClusterConstruct } from './cluster';
import { AlbConstruct } from './alb';
import { ContainersConstruct } from './containers';


export interface CacclAppStackProps {
  readonly cidrBlock: string;
  readonly certificateArn: string;
  readonly appName: string;
  readonly appHost: string;
  readonly appImage?: string;
  readonly appBuildPath?: string;
  readonly appEnvironment?: { [key: string]: string; };
  readonly proxyImage?: string;
  readonly proxyEnvironment?: { [key: string]: string; };
  readonly taskCpu?: number;
  readonly taskMemoryLimit?: number;
  readonly logRetentionDays?: number;
}

export class CacclAppStack extends Stack {
  constructor(scope: Construct, id: string, props: CacclAppStackProps) {
    super(scope, id);

    const {
      cidrBlock,
      certificateArn,
      appName,
      appHost,
      appImage,
      appBuildPath,
      appEnvironment,
      proxyImage,
      proxyEnvironment,
      taskCpu = 512,
      taskMemoryLimit = 1024,
      logRetentionDays = 90,
    } = props;

    // network stuff
    const vpcConstruct = new VpcConstruct(this, 'Vpc', { cidrBlock });

    // the ECS cluster; services and tasks are created by the app(s)
    const clusterConstruct = new ClusterConstruct(this, 'Cluster', {
      vpc: vpcConstruct.vpc,
    });

    const taskDef = new FargateTaskDefinition(this, 'Task', {
      cpu: taskCpu,
      memoryLimitMiB: taskMemoryLimit,
    });

    const containersConstruct = new ContainersConstruct(this, 'Containers', {
      taskDef,
      appImage,
      appBuildPath,
      appEnvironment,
      proxyImage,
      proxyEnvironment,
      logRetentionDays,
    })

    const fargateService = new FargateService(this, 'FargateService', {
      cluster: clusterConstruct.cluster,
      securityGroup: vpcConstruct.securityGroup,
      taskDefinition: taskDef,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      serviceName: `${appName.toLowerCase()}-service`,
    });

    /**
     * here we create a service target that uses a specific container/port
    * without this the load balancer target won't point to the right container
    */
    const loadBalancerTarget = fargateService.loadBalancerTarget({
      containerName: containersConstruct.proxyContainer.containerName,
      containerPort: 443,
    });

    // application load balancer; the app(s) will attach themselves as
    // "targets" of the https listener
    const albConstruct = new AlbConstruct(this, 'LoadBalancer', {
      certificateArn,
      vpc: vpcConstruct.vpc,
      securityGroup: vpcConstruct.securityGroup,
      loadBalancerTarget,
    });

  }
}
