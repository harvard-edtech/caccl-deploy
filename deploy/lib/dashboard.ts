import { Dashboard, GraphWidget, TextWidget, Metric, Unit } from '@aws-cdk/aws-cloudwatch';
import { DatabaseCluster } from '@aws-cdk/aws-docdb';
import { FargateService } from '@aws-cdk/aws-ecs';
import { HttpCodeTarget, ApplicationLoadBalancer } from '@aws-cdk/aws-elasticloadbalancingv2';
import { Construct, CfnOutput, Stack } from '@aws-cdk/core';

export interface CacclMonitoringProps {
  loadBalancer: ApplicationLoadBalancer;
  service: FargateService;
}

export class CacclMonitoring extends Construct {
  dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: CacclMonitoringProps) {
    super(scope, id);

    const { stackName } = Stack.of(this);
    const { region } = Stack.of(this);

    const dashboardName = `${stackName}-metrics`;
    this.dashboard = new Dashboard(this, 'Dashboard', { dashboardName });

    const dashboardLink = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=${dashboardName}`;

    new CfnOutput(this, 'DashboardLink', {
      value: dashboardLink,
    });

    const lbLink = `https://console.aws.amazon.com/ec2/v2/home?region=${region}#LoadBalancers:tag:caccl_deploy_stack_name=${stackName}`;

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: [
          `### Load Balancer: [${props.loadBalancer.loadBalancerName}](${lbLink})`,
          '[Explanation of Metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)',
        ].join(' | '),
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'RequestCount',
        left: [props.loadBalancer.metricRequestCount()],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'TargetResponseTime',
        left: [props.loadBalancer.metricTargetResponseTime()],
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'NewConnectionCount',
        left: [props.loadBalancer.metricNewConnectionCount()],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'ActiveConnectionCount',
        left: [props.loadBalancer.metricActiveConnectionCount()],
        width: 12,
        height: 6,
      }),
    );

    const httpCodeWidgets = ['2', '3', '4', '5'].map((i) => {
      const metricName = `HTTP ${i}xx Count`;
      const httpCode = `TARGET_${i}XX_COUNT` as keyof typeof HttpCodeTarget;
      return new GraphWidget({
        title: metricName,
        left: [props.loadBalancer.metricHttpCodeTarget(HttpCodeTarget[httpCode])],
      });
    });
    this.dashboard.addWidgets(...httpCodeWidgets);

    const serviceLink = `https://console.aws.amazon.com/ecs/home?region=${region}#/clusters/${props.service.cluster.clusterName}/services/${props.service.serviceName}/details`;

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `### ECS Service: [${props.service.serviceName}](${serviceLink})`,
        width: 24,
        height: 1,
      }),
    );

    const makeCIMetric = (metricName: string, extraProps = {}) => {
      const metric = new Metric({
        metricName,
        namespace: 'ECS/ContainerInsights',
        dimensions: {
          ClusterName: props.service.cluster.clusterName,
          ServiceName: props.service.serviceName,
        },
        ...extraProps,
      });
      metric.attachTo(props.service);
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
    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'Storage Read/Write Bytes',
        left: [makeCIMetric('StorageReadBytes')],
        right: [makeCIMetric('StorageWriteBytes')],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'Tasks & Deployments',
        left: [makeCIMetric('DesiredTaskCount'), makeCIMetric('PendingTaskCount'), makeCIMetric('RunningTaskCount')],
        right: [props.service.metric('DeploymentCount')],
        width: 12,
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

  addDocDbSection(docdb: DatabaseCluster): void {
    const { region } = Stack.of(this);
    const dbLink = `https://console.aws.amazon.com/docdb/home?region=${region}#cluster-details/${docdb.clusterIdentifier}`;
    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `### DocDB Cluster: [${docdb.clusterIdentifier}](${dbLink})`,
        width: 24,
        height: 1,
      }),
    );

    const makeDocDbMetric = (metricName: string, extraProps = {}) => {
      const metric = new Metric({
        metricName,
        namespace: 'AWS/DocDB',
        dimensions: {
          DBClusterIdentifier: docdb.clusterIdentifier,
        },
        ...extraProps,
      });
      metric.attachTo(docdb);
      return metric;
    };

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'Read/Write IOPS',
        left: [makeDocDbMetric('ReadIOPS')],
        right: [makeDocDbMetric('WriteIOPS')],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'CPU & Memory',
        left: [makeDocDbMetric('CPUUtilization', { unit: Unit.PERCENT })],
        right: [makeDocDbMetric('FreeableMemory')],
        width: 12,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new GraphWidget({
        left: [makeDocDbMetric('BufferCacheHitRatio', { unit: Unit.PERCENT })],
      }),
      new GraphWidget({
        left: [makeDocDbMetric('DatabaseConnections')],
      }),
      new GraphWidget({
        left: [makeDocDbMetric('DiskQueueDepth')],
      }),
      new GraphWidget({
        title: 'Read/Write Latency',
        left: [makeDocDbMetric('ReadLatency')],
        right: [makeDocDbMetric('WriteLatency')],
      }),
    );
  }
}
