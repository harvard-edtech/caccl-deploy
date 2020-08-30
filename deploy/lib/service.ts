import { SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster, FargateService, IEcsLoadBalancerTarget } from '@aws-cdk/aws-ecs';
import { RuleTargetInput, EventField } from '@aws-cdk/aws-events';
import { Construct, Stack } from '@aws-cdk/core';
import { CacclNotifications } from './notify';
import { CacclTaskDef } from './taskdef';

export interface CacclServiceProps {
  cluster: Cluster;
  sg: SecurityGroup;
  taskDef: CacclTaskDef;
  taskCount: number;
  notifier: CacclNotifications;
}

const NOTIFICATION_INPUT = RuleTargetInput.fromText(`
  Event: ${EventField.fromPath('$.detail.eventName')}
  Service: ${EventField.fromPath('$.resources[0]')}
`);

export class CacclService extends Construct {
  loadBalancerTarget: IEcsLoadBalancerTarget;

  ecsService: FargateService;

  constructor(scope: Construct, id: string, props: CacclServiceProps) {
    super(scope, id);

    const { sg, cluster, taskDef, taskCount, notifier } = props;
    const serviceName = `${Stack.of(this).stackName}-service`;

    this.ecsService = new FargateService(this, 'FargateService', {
      cluster,
      serviceName,
      securityGroup: sg,
      taskDefinition: taskDef.taskDef,
      desiredCount: taskCount,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // this is the thing that gets handed off to the load balancer
    this.loadBalancerTarget = this.ecsService.loadBalancerTarget({
      containerName: taskDef.proxyContainer.containerName,
      containerPort: 443,
    });

    notifier.addNotificationRule(
      `${serviceName}-events`,
      {
        detailType: ['ECS Service Action'],
        source: ['aws.ecs'],
        resources: [this.ecsService.serviceArn],
      },
      {
        message: NOTIFICATION_INPUT,
      },
    );
  }
}
