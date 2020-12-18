import { Dashboard, GraphWidget, TextWidget, Metric, Unit, AlarmStatusWidget } from '@aws-cdk/aws-cloudwatch';
import { HttpCodeTarget } from '@aws-cdk/aws-elasticloadbalancingv2';
import { Construct, CfnOutput, Stack } from '@aws-cdk/core';

import { CacclDocDb } from './docdb';
import { CacclLoadBalancer } from './lb';
import { CacclService } from './service';

export interface CacclMonitoringProps {
  cacclLoadBalancer: CacclLoadBalancer;
  cacclService: CacclService;
}

export class CacclMonitoring extends Construct {
  dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: CacclMonitoringProps) {
    super(scope, id);

    const { stackName } = Stack.of(this);
    const { region } = Stack.of(this);

    const { cacclLoadBalancer, cacclService } = props;
    const { loadBalancer } = cacclLoadBalancer;
    const { ecsService } = cacclService;

    const dashboardName = `${stackName}-metrics`;
    this.dashboard = new Dashboard(this, 'Dashboard', { dashboardName });

    const dashboardLink = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=${dashboardName}`;

    new CfnOutput(this, 'DashboardLink', {
      value: dashboardLink,
      exportName: `${stackName}-cloudwatch-dashboard-link`,
    });

    const lbLink = `https://console.aws.amazon.com/ec2/v2/home?region=${region}#LoadBalancers:tag:caccl_deploy_stack_name=${stackName}`;

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: [
          `### Load Balancer: [${loadBalancer.loadBalancerName}](${lbLink})`,
          '[Explanation of Metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)',
        ].join(' | '),
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'RequestCount',
        left: [cacclLoadBalancer.metrics.RequestCount],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'TargetResponseTime',
        left: [cacclLoadBalancer.metrics.TargetResponseTime],
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new AlarmStatusWidget({
        alarms: cacclLoadBalancer.alarms,
        height: 6,
        width: 8,
        title: 'Load Balancer Alarm States',
      }),
      new GraphWidget({
        title: 'NewConnectionCount',
        left: [cacclLoadBalancer.metrics.NewConnectionCount],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: 'ActiveConnectionCount',
        left: [cacclLoadBalancer.metrics.ActiveConnectionCount],
        width: 8,
        height: 6,
      }),
    );

    const httpCodeWidgets = ['2', '3', '4', '5'].map((i) => {
      const metricName = `HTTP ${i}xx Count`;
      const httpCode = `TARGET_${i}XX_COUNT` as keyof typeof HttpCodeTarget;
      return new GraphWidget({
        title: metricName,
        left: [loadBalancer.metricHttpCodeTarget(HttpCodeTarget[httpCode])],
      });
    });
    this.dashboard.addWidgets(...httpCodeWidgets);

    const serviceLink = `https://console.aws.amazon.com/ecs/home?region=${region}#/clusters/${ecsService.cluster.clusterName}/services/${ecsService.serviceName}/details`;

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `### ECS Service: [${ecsService.serviceName}](${serviceLink})`,
        width: 24,
        height: 1,
      }),
    );

    const makeCIMetric = (metricName: string, extraProps = {}) => {
      const metric = new Metric({
        metricName,
        namespace: 'ECS/ContainerInsights',
        dimensions: {
          ClusterName: ecsService.cluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        ...extraProps,
      });
      metric.attachTo(ecsService);
      return metric;
    };

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'CPUUtilization',
        left: [
          makeCIMetric('CpuUtilized', { unit: Unit.PERCENT }),
          makeCIMetric('CpuReserved', { unit: Unit.PERCENT }),
        ],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'MemoryUtilization',
        left: [makeCIMetric('MemoryUtilized'), makeCIMetric('MemoryReserved')],
        width: 12,
        height: 6,
      }),
    );

    let servcieAlarmWidget = [];

    if (cacclService.alarms.length) {
      servcieAlarmWidget.push(
        new AlarmStatusWidget({
          alarms: cacclService.alarms,
          width: 8,
          height: 6,
          title: 'ECS Service Alarm States',
        })
      );
    }

    this.dashboard.addWidgets(
      ...servcieAlarmWidget,
      new GraphWidget({
        title: 'Storage Read/Write Bytes',
        left: [makeCIMetric('StorageReadBytes')],
        right: [makeCIMetric('StorageWriteBytes')],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: 'Tasks & Deployments',
        left: [makeCIMetric('DesiredTaskCount'), makeCIMetric('PendingTaskCount'), makeCIMetric('RunningTaskCount')],
        right: [ecsService.metric('DeploymentCount')],
        width: 8,
        height: 6,
      }),
    );

    const makeLogLink = (logGroup: string) => {
      const escapedLg = logGroup.split('/').join('$252F');
      return `* [${logGroup}](https://console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${escapedLg})`;
    };

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: ['### Logs\n', makeLogLink(`/${stackName}/app`), makeLogLink(`/${stackName}/proxy`)].join('\n'),
        width: 24,
        height: 6,
      }),
    );
  }

  addDocDbSection(cacclDocDb: CacclDocDb): void {
    const { region } = Stack.of(this);
    const { dbCluster } = cacclDocDb;

    const dbLink = `https://console.aws.amazon.com/docdb/home?region=${region}#cluster-details/${dbCluster.clusterIdentifier}`;

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `### DocDB Cluster: [${dbCluster.clusterIdentifier}](${dbLink})`,
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'Read/Write IOPS',
        left: [cacclDocDb.metrics.ReadIOPS],
        right: [cacclDocDb.metrics.WriteIOPS],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: 'CPU & Memory',
        left: [cacclDocDb.metrics.CPUUtilization],
        right: [cacclDocDb.metrics.FreeableMemory],
        width: 8,
        height: 6,
      }),
      new GraphWidget({
        title: 'CursorsTimedOut',
        left: [cacclDocDb.metrics.DatabaseCursorsTimedOut],
        width: 8,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new AlarmStatusWidget({
        alarms: cacclDocDb.alarms,
        width: 24,
        height: 6,
        title: 'DocDb Alarm States',
      }),
    );
    this.dashboard.addWidgets(
      new GraphWidget({
        left: [cacclDocDb.metrics.BufferCacheHitRatio],
      }),
      new GraphWidget({
        left: [cacclDocDb.metrics.DatabaseConnections],
      }),
      new GraphWidget({
        left: [cacclDocDb.metrics.DiskQueueDepth],
      }),
      new GraphWidget({
        title: 'Read/Write Latency',
        left: [cacclDocDb.metrics.ReadLatency],
        right: [cacclDocDb.metrics.WriteLatency],
      }),
    );
  };
}
