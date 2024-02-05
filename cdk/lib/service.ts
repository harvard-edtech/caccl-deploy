import {
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  CfnOutput,
  Stack,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacclTaskDef } from './taskdef';

export interface CacclServiceProps {
  cluster: ecs.Cluster;
  taskDef: CacclTaskDef;
  taskCount: number;
  loadBalancerSg: ec2.SecurityGroup;
  enableExecuteCommand?: boolean;
}

export class CacclService extends Construct {
  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;

  ecsService: ecs.FargateService;

  alarms: cloudwatch.Alarm[];

  constructor(scope: Construct, id: string, props: CacclServiceProps) {
    super(scope, id);

    const {
      cluster,
      taskDef,
      taskCount,
      loadBalancerSg,
      enableExecuteCommand = false,
    } = props;

    const serviceSg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: cluster.vpc,
      description: 'ecs service security group',
    });
    // Load balancer to tasks
    serviceSg.connections.allowFrom(loadBalancerSg, ec2.Port.tcp(443));

    this.ecsService = new ecs.FargateService(this, 'FargateService', {
      cluster,
      securityGroups: [serviceSg],
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
      taskDefinition: taskDef.taskDef,
      desiredCount: taskCount,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: {
        rollback: true,
      },
      propagateTags: ecs.PropagatedTagSource.SERVICE,
      enableExecuteCommand,
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
