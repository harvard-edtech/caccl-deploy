import {
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_logs as logs,
  CfnOutput,
  Duration,
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

    // Apps can trigger an alert by printing a single-line JSON object with
    // "cacclDeployAlert": true to stdout/stderr (e.g. when a user sees a
    // fatal error screen)
    const appAlertMetricFilter = new logs.MetricFilter(
      this,
      'AppAlertMetricFilter',
      {
        logGroup: taskDef.appLogGroup,
        filterPattern: logs.FilterPattern.booleanValue(
          '$.cacclDeployAlert',
          true,
        ),
        metricNamespace: 'CacclDeploy',
        metricName: `${Stack.of(this).stackName}-AppAlertCount`,
        metricValue: '1',
      },
    );

    this.alarms = [
      new cloudwatch.Alarm(this, 'AppAlertAlarm', {
        metric: appAlertMetricFilter.metric({
          period: Duration.minutes(1),
          statistic: 'sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        // no datapoint means no alerts, so the alarm can reset
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${
          Stack.of(this).stackName
        } app logged an alert (search the app log group for cacclDeployAlert)`,
      }),
    ];

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
