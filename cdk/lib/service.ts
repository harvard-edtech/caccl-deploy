import { Alarm } from '@aws-cdk/aws-cloudwatch';
import { Port, SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster, FargatePlatformVersion, FargateService, IEcsLoadBalancerTarget, PropagatedTagSource } from '@aws-cdk/aws-ecs';
import { CfnOutput, Construct, Stack } from '@aws-cdk/core';

import { CacclTaskDef } from './taskdef';

export interface CacclServiceProps {
  cluster: Cluster;
  taskDef: CacclTaskDef;
  taskCount: number;
  loadBalancerSg: SecurityGroup;
}

export class CacclService extends Construct {
  loadBalancerTarget: IEcsLoadBalancerTarget;

  ecsService: FargateService;

  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclServiceProps) {
    super(scope, id);

    const { cluster, taskDef, taskCount, loadBalancerSg } = props;

    const serviceSg = new SecurityGroup(this, 'SecurityGroup', {
      vpc: cluster.vpc,
      description: 'ecs service security group',
    });
    // Load balancer to tasks
    serviceSg.connections.allowFrom(loadBalancerSg, Port.tcp(443));

    this.ecsService = new FargateService(this, 'FargateService', {
      cluster,
      securityGroups: [serviceSg],
      platformVersion: FargatePlatformVersion.VERSION1_4,
      taskDefinition: taskDef.taskDef,
      desiredCount: taskCount,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: {
        rollback: true,
      },
      propagateTags: PropagatedTagSource.SERVICE,
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
      value: this.ecsService.serviceName,
    });
  }
}
