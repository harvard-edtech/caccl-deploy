import {
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
  CfnOutput,
  Stack,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types

import CacclDbBase from './CacclDbBase.js';
import CacclScheduledTasks from './CacclScheduledTasks.js';
import { CacclMonitoringProps } from '../../../types/index.js';

class CacclMonitoring extends Construct {
  dashboard: cloudwatch.Dashboard;

  region: string;

  constructor(scope: Construct, id: string, props: CacclMonitoringProps) {
    super(scope, id);

    const { stackName } = Stack.of(this);

    const { cacclLoadBalancer, cacclService } = props;
    const { loadBalancer } = cacclLoadBalancer;
    const { ecsService } = cacclService;

    const dashboardName = `${stackName}-metrics`;
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName,
    });
    this.region = Stack.of(this).region;

    const dashboardLink = `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboardName}`;

    new CfnOutput(this, 'DashboardLink', {
      value: dashboardLink,
      exportName: `${stackName}-cloudwatch-dashboard-link`,
    });

    const lbLink = `https://console.aws.amazon.com/ec2/v2/home?region=${this.region}#LoadBalancers:tag:caccl_deploy_stack_name=${stackName}`;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: [
          `### Load Balancer: [${loadBalancer.loadBalancerName}](${lbLink})`,
          '[Explanation of Metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)',
        ].join(' | '),
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RequestCount',
        left: [cacclLoadBalancer.metrics.RequestCount],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'TargetResponseTime',
        left: [cacclLoadBalancer.metrics.TargetResponseTime],
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        alarms: cacclLoadBalancer.alarms,
        height: 6,
        width: 8,
        title: 'Load Balancer Alarm States',
      }),
      new cloudwatch.GraphWidget({
        title: 'NewConnectionCount',
        left: [cacclLoadBalancer.metrics.NewConnectionCount],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ActiveConnectionCount',
        left: [cacclLoadBalancer.metrics.ActiveConnectionCount],
        width: 8,
        height: 6,
      }),
    );

    const httpCodeWidgets = ['2', '3', '4', '5'].map((i) => {
      const metricName = `HTTP ${i}xx Count`;
      const httpCode = `TARGET_${i}XX_COUNT` as keyof typeof elb.HttpCodeTarget;
      return new cloudwatch.GraphWidget({
        title: metricName,
        left: [loadBalancer.metricHttpCodeTarget(elb.HttpCodeTarget[httpCode])],
      });
    });
    this.dashboard.addWidgets(...httpCodeWidgets);

    const serviceLink = `https://console.aws.amazon.com/ecs/home?region=${this.region}#/clusters/${ecsService.cluster.clusterName}/services/${ecsService.serviceName}/details`;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `### ECS Service: [${ecsService.serviceName}](${serviceLink})`,
        width: 24,
        height: 1,
      }),
    );

    const makeCIMetric = (metricName: string, extraProps = {}) => {
      const metric = new cloudwatch.Metric({
        metricName,
        namespace: 'ECS/ContainerInsights',
        dimensionsMap: {
          ClusterName: ecsService.cluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        ...extraProps,
      });
      metric.attachTo(ecsService);
      return metric;
    };

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'CPUUtilization',
        left: [
          makeCIMetric('CpuUtilized', { unit: cloudwatch.Unit.PERCENT }),
          makeCIMetric('CpuReserved', { unit: cloudwatch.Unit.PERCENT }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'MemoryUtilization',
        left: [makeCIMetric('MemoryUtilized'), makeCIMetric('MemoryReserved')],
        width: 12,
        height: 6,
      }),
    );

    const servcieAlarmWidget = [];

    if (cacclService.alarms.length) {
      servcieAlarmWidget.push(
        new cloudwatch.AlarmStatusWidget({
          alarms: cacclService.alarms,
          width: 8,
          height: 6,
          title: 'ECS Service Alarm States',
        }),
      );
    }

    this.dashboard.addWidgets(
      ...servcieAlarmWidget,
      new cloudwatch.GraphWidget({
        title: 'Storage Read/Write Bytes',
        left: [makeCIMetric('StorageReadBytes')],
        right: [makeCIMetric('StorageWriteBytes')],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Tasks & Deployments',
        left: [
          makeCIMetric('DesiredTaskCount'),
          makeCIMetric('PendingTaskCount'),
          makeCIMetric('RunningTaskCount'),
        ],
        right: [ecsService.metric('DeploymentCount')],
        width: 12,
        height: 6,
      }),
    );

    const makeLogLink = (logGroup: string) => {
      const escapedLg = logGroup.split('/').join('$252F');
      return `* [${logGroup}](https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#logsV2:log-groups/log-group/${escapedLg})`;
    };

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: [
          '### Logs\n',
          makeLogLink(`/${stackName}/app`),
          makeLogLink(`/${stackName}/proxy`),
        ].join('\n'),
        width: 24,
        height: 4,
      }),
    );
  }

  addDbSection(db: CacclDbBase): void {
    const { dbCluster } = db;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `### Database Cluster: [${
          dbCluster.clusterIdentifier
        }](${db.getDashboardLink()})`,
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Read/Write IOPS',
        left: db.metrics.ReadIOPS,
        right: db.metrics.WriteIOPS,
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'CPU & Memory',
        left: db.metrics.CPUUtilization,
        right: db.metrics.FreeableMemory,
        width: 12,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Read/Write Latency',
        left: db.metrics.ReadLatency,
        right: db.metrics.WriteLatency,
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Transactions/Queries',
        left: db.metrics.Transactions,
        right: db.metrics.Queries,
        width: 12,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        alarms: db.alarms,
        width: 24,
        height: 6,
        title: 'Database Alarm States',
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        left: db.metrics.BufferCacheHitRatio,
      }),
      new cloudwatch.GraphWidget({
        left: db.metrics.DatabaseConnections,
      }),
      new cloudwatch.GraphWidget({
        left: db.metrics.DiskQueueDepth,
      }),
      new cloudwatch.GraphWidget({
        left: db.metrics.DatabaseCursorsTimedOut,
      }),
    );
  }

  addScheduledTasksSection(scheduledTasks: CacclScheduledTasks): void {
    const func = scheduledTasks.taskExecFunction;
    const functionUrl = `https://console.aws.amazon.com/lambda/home?region=${this.region}#/functions/${func.functionName}`;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `###  Scheduled Tasks Function: [${func.functionName}](${functionUrl})`,
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Duration',
        left: [func.metricDuration()],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Invocations',
        left: [func.metricInvocations()],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Errors',
        left: [func.metricErrors()],
        width: 8,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        alarms: scheduledTasks.alarms,
        width: 24,
        height: 6,
        title: 'Scheduled Tasks Function Alarm States',
      }),
    );
  }
}

export default CacclMonitoring;
