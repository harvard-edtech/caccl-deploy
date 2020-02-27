import { Stack, Construct } from '@aws-cdk/core';
import { VpcConstruct } from './vpc';
import { AlbConstruct } from './alb';
import { EcsConstruct } from './ecs';

export interface CacclAppStackProps {
  readonly cidrBlock: string;
  readonly certificateArn: string;
  readonly appName: string;
  readonly appHost?: string;
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

    const ecsConstruct = new EcsConstruct(this, 'Ecs', {
      vpc: vpcConstruct.vpc,
      securityGroup: vpcConstruct.securityGroup,
      appName,
      appImage,
      appBuildPath,
      appEnvironment,
      proxyImage,
      proxyEnvironment,
      taskCpu,
      taskMemoryLimit,
      logRetentionDays,
    })

    // application load balancer; the app(s) will attach themselves as
    // "targets" of the https listener
    const albConstruct = new AlbConstruct(this, 'LoadBalancer', {
      certificateArn,
      vpc: vpcConstruct.vpc,
      securityGroup: vpcConstruct.securityGroup,
      loadBalancerTarget: ecsConstruct.loadBalancerTarget,
    });
  }
}
