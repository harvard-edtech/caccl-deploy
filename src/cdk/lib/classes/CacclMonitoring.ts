/* eslint-disable unicorn/consistent-destructuring */
import {
  CfnOutput,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types

import { CacclMonitoringProps } from '../../../types/index.js';
import CacclDbBase from './CacclDbBase.js';
import CacclScheduledTasks from './CacclScheduledTasks.js';

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
      exportName: `${stackName}-cloudwatch-dashboard-link`,
      value: dashboardLink,
    });

    const lbLink = `https://console.aws.amazon.com/ec2/v2/home?region=${this.region}#LoadBalancers:tag:caccl_deploy_stack_name=${stackName}`;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        height: 1,
        markdown: [
          `### Load Balancer: [${loadBalancer.loadBalancerName}](${lbLink})`,
          '[Explanation of Metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)',
        ].join(' | '),
        width: 24,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        height: 6,
        left: [cacclLoadBalancer.metrics.RequestCount],
        title: 'RequestCount',
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [cacclLoadBalancer.metrics.TargetResponseTime],
        title: 'TargetResponseTime',
        width: 12,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        alarms: cacclLoadBalancer.alarms,
        height: 6,
        title: 'Load Balancer Alarm States',
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [cacclLoadBalancer.metrics.NewConnectionCount],
        title: 'NewConnectionCount',
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [cacclLoadBalancer.metrics.ActiveConnectionCount],
        title: 'ActiveConnectionCount',
        width: 8,
      }),
    );

    const httpCodeWidgets = ['2', '3', '4', '5'].map((i) => {
      const metricName = `HTTP ${i}xx Count`;
      const httpCode = `TARGET_${i}XX_COUNT` as keyof typeof elb.HttpCodeTarget;
      return new cloudwatch.GraphWidget({
        left: [loadBalancer.metricHttpCodeTarget(elb.HttpCodeTarget[httpCode])],
        title: metricName,
      });
    });
    this.dashboard.addWidgets(...httpCodeWidgets);

    const serviceLink = `https://console.aws.amazon.com/ecs/home?region=${this.region}#/clusters/${ecsService.cluster.clusterName}/services/${ecsService.serviceName}/details`;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        height: 1,
        markdown: `### ECS Service: [${ecsService.serviceName}](${serviceLink})`,
        width: 24,
      }),
    );

    const makeCIMetric = (metricName: string, extraProps = {}) => {
      const metric = new cloudwatch.Metric({
        dimensionsMap: {
          ClusterName: ecsService.cluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        metricName,
        namespace: 'ECS/ContainerInsights',
        ...extraProps,
      });
      metric.attachTo(ecsService);
      return metric;
    };

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        height: 6,
        left: [
          makeCIMetric('CpuUtilized', { unit: cloudwatch.Unit.PERCENT }),
          makeCIMetric('CpuReserved', { unit: cloudwatch.Unit.PERCENT }),
        ],
        title: 'CPUUtilization',
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [makeCIMetric('MemoryUtilized'), makeCIMetric('MemoryReserved')],
        title: 'MemoryUtilization',
        width: 12,
      }),
    );

    const servcieAlarmWidget = [];

    if (cacclService.alarms.length > 0) {
      servcieAlarmWidget.push(
        new cloudwatch.AlarmStatusWidget({
          alarms: cacclService.alarms,
          height: 6,
          title: 'ECS Service Alarm States',
          width: 8,
        }),
      );
    }

    this.dashboard.addWidgets(
      ...servcieAlarmWidget,
      new cloudwatch.GraphWidget({
        height: 6,
        left: [makeCIMetric('StorageReadBytes')],
        right: [makeCIMetric('StorageWriteBytes')],
        title: 'Storage Read/Write Bytes',
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [
          makeCIMetric('DesiredTaskCount'),
          makeCIMetric('PendingTaskCount'),
          makeCIMetric('RunningTaskCount'),
        ],
        right: [ecsService.metric('DeploymentCount')],
        title: 'Tasks & Deployments',
        width: 12,
      }),
    );

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const makeLogLink = (logGroup: string) => {
      const escapedLg = logGroup.split('/').join('$252F');
      return `* [${logGroup}](https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#logsV2:log-groups/log-group/${escapedLg})`;
    };

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        height: 4,
        markdown: [
          '### Logs\n',
          makeLogLink(`/${stackName}/app`),
          makeLogLink(`/${stackName}/proxy`),
        ].join('\n'),
        width: 24,
      }),
    );
  }

  addDbSection(db: CacclDbBase): void {
    const { dbCluster } = db;

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        height: 1,
        markdown: `### Database Cluster: [${
          dbCluster.clusterIdentifier
        }](${db.getDashboardLink()})`,
        width: 24,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        height: 6,
        left: db.metrics.ReadIOPS,
        right: db.metrics.WriteIOPS,
        title: 'Read/Write IOPS',
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: db.metrics.CPUUtilization,
        right: db.metrics.FreeableMemory,
        title: 'CPU & Memory',
        width: 12,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        height: 6,
        left: db.metrics.ReadLatency,
        right: db.metrics.WriteLatency,
        title: 'Read/Write Latency',
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: db.metrics.Transactions,
        right: db.metrics.Queries,
        title: 'Transactions/Queries',
        width: 12,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        alarms: db.alarms,
        height: 6,
        title: 'Database Alarm States',
        width: 24,
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
        height: 1,
        markdown: `###  Scheduled Tasks Function: [${func.functionName}](${functionUrl})`,
        width: 24,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        height: 6,
        left: [func.metricDuration()],
        title: 'Duration',
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [func.metricInvocations()],
        title: 'Invocations',
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        height: 6,
        left: [func.metricErrors()],
        title: 'Errors',
        width: 8,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        alarms: scheduledTasks.alarms,
        height: 6,
        title: 'Scheduled Tasks Function Alarm States',
        width: 24,
      }),
    );
  }
}

export default CacclMonitoring;
