import { Construct, Stack } from '@aws-cdk/core';
import { SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster, FargateService, IEcsLoadBalancerTarget } from '@aws-cdk/aws-ecs';
import { CacclTaskDef } from './taskdef';

export interface CacclServiceProps {
  cluster: Cluster;
  sg: SecurityGroup;
  taskDef: CacclTaskDef;
  taskCount: number;
}

export class CacclService extends Construct {
  loadBalancerTarget: IEcsLoadBalancerTarget;
  ecsService: FargateService;

  constructor(scope: Construct, id: string, props: CacclServiceProps) {
    super(scope, id);

    const { sg, cluster, taskDef, taskCount } = props;

    this.ecsService = new FargateService(this, 'FargateService', {
      cluster,
      securityGroup: sg,
      taskDefinition: taskDef.taskDef,
      desiredCount: taskCount,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      serviceName: `${Stack.of(this).stackName}-service`,
    });

    // this is the thing that gets handed off to the load balancer
    this.loadBalancerTarget = this.ecsService.loadBalancerTarget({
      containerName: taskDef.proxyContainer.containerName,
      containerPort: 443,
    });
  }
}
