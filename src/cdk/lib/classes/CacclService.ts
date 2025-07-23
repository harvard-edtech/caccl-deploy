// Import AWS CDK lib
import {
  CfnOutput,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
// Import AWS constructs
import { Construct } from 'constructs';

// Import shared types
import { type CacclServiceProps } from '../../../types/index.js';

class CacclService extends Construct {
  alarms: cloudwatch.Alarm[];

  ecsService: ecs.FargateService;

  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;

  constructor(scope: Construct, id: string, props: CacclServiceProps) {
    super(scope, id);

    const {
      cluster,
      enableExecuteCommand = false,
      loadBalancerSg,
      taskCount,
      taskDef,
    } = props;

    const serviceSg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      description: 'ecs service security group',
      vpc: cluster.vpc,
    });
    // Load balancer to tasks
    serviceSg.connections.allowFrom(loadBalancerSg, ec2.Port.tcp(443));

    this.ecsService = new ecs.FargateService(this, 'FargateService', {
      circuitBreaker: {
        rollback: true,
      },
      cluster,
      desiredCount: taskCount,
      enableExecuteCommand,
      maxHealthyPercent: 200,
      minHealthyPercent: 100,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
      securityGroups: [serviceSg],
      taskDefinition: taskDef.taskDef,
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

export default CacclService;
