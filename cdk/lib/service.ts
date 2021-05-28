import { Alarm } from '@aws-cdk/aws-cloudwatch';
import { SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster, FargatePlatformVersion, FargateService, IEcsLoadBalancerTarget } from '@aws-cdk/aws-ecs';
import { CfnOutput, Construct, Stack } from '@aws-cdk/core';

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

  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclServiceProps) {
    super(scope, id);

    const { sg, cluster, taskDef, taskCount } = props;
    const serviceName = `${Stack.of(this).stackName}-service`;

    this.ecsService = new FargateService(this, 'FargateService', {
      cluster,
      serviceName,
      platformVersion: FargatePlatformVersion.VERSION1_3,
      securityGroup: sg,
      taskDefinition: taskDef.taskDef,
      desiredCount: taskCount,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: {
        rollback: true,
      },
    });

    // this is the thing that gets handed off to the load balancer
    this.loadBalancerTarget = this.ecsService.loadBalancerTarget({
      containerName: taskDef.proxyContainer.containerName,
      containerPort: 443,
    });

    this.alarms = [];

    new CfnOutput(this, 'ClusterName', {
      exportName: `${Stack.of(this).stackName}-cluster-name`,
      value: cluster.clusterName,
    });

    new CfnOutput(this, 'ServiceName', {
      exportName: `${Stack.of(this).stackName}-service-name`,
      value: serviceName,
    });
  }
}
