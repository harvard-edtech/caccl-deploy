import { Alarm, Metric, TreatMissingData, Unit } from '@aws-cdk/aws-cloudwatch';
import { SecurityGroup, Vpc, Peer, Port } from '@aws-cdk/aws-ec2';
import { IEcsLoadBalancerTarget } from '@aws-cdk/aws-ecs';
import {
  ApplicationLoadBalancer,
  CfnListener,
  ApplicationProtocol,
  ApplicationListener,
  ApplicationTargetGroup,
  TargetType,
} from '@aws-cdk/aws-elasticloadbalancingv2';
import { Bucket } from '@aws-cdk/aws-s3';
import { Construct, Duration, Stack } from '@aws-cdk/core';

export interface CacclLoadBalancerProps {
  sg: SecurityGroup;
  vpc: Vpc;
  certificateArn: string;
  loadBalancerTarget: IEcsLoadBalancerTarget;
  loadBalancerLogBucket?: string;
}

export class CacclLoadBalancer extends Construct {
  loadBalancer: ApplicationLoadBalancer;

  httpsListener: ApplicationListener;

  metrics: { [key: string]: Metric };

  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclLoadBalancerProps) {
    super(scope, id);

    const { sg, vpc, certificateArn, loadBalancerTarget, loadBalancerLogBucket } = props;

    this.loadBalancer = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      securityGroup: sg,
      internetFacing: true,
    });

    if (loadBalancerLogBucket !== undefined) {
      const bucket = Bucket.fromBucketName(this, 'AlbLogBucket', loadBalancerLogBucket);
      const objPrefix = Stack.of(this).stackName;
      this.loadBalancer.logAccessLogs(bucket, objPrefix);
    }

    new CfnListener(this, 'HttpRedirect', {
      loadBalancerArn: this.loadBalancer.loadBalancerArn,
      protocol: ApplicationProtocol.HTTP,
      port: 80,
      defaultActions: [
        {
          type: 'redirect',
          redirectConfig: {
            statusCode: 'HTTP_301',
            port: '443',
            protocol: 'HTTPS',
            host: '#{host}',
            path: '/#{path}',
            query: '#{query}',
          },
        },
      ],
    });

    const httpsListener = new ApplicationListener(this, 'HttpsListener', {
      loadBalancer: this.loadBalancer,
      certificates: [{ certificateArn }],
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
    });

    const appTargetGroup = new ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      // setting this duration value enables the lb stickiness; 1 day is the default
      stickinessCookieDuration: Duration.seconds(86400),
      deregistrationDelay: Duration.seconds(30),
      targetType: TargetType.IP,
      targets: [loadBalancerTarget],
    });

    httpsListener.addTargetGroups('AppTargetGroup', {
      targetGroups: [appTargetGroup],
    });

    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(443));

    this.metrics = {
      RequestCount: this.loadBalancer.metricRequestCount(),
      NewConnectionCount: this.loadBalancer.metricNewConnectionCount(),
      ActiveConnectionCount: this.loadBalancer.metricActiveConnectionCount(),
      TargetResponseTime: this.loadBalancer.metricTargetResponseTime({
        period: Duration.minutes(1),
        unit: Unit.MILLISECONDS,
        statistic: 'avg',
      }),
      RejectedConnectionCount: this.loadBalancer.metricRejectedConnectionCount({
        period: Duration.minutes(1),
        statistic: 'sum',
      }),
      UnHealthyHostCount: appTargetGroup.metricUnhealthyHostCount({
        period: Duration.minutes(1),
        statistic: 'sum',
      }),
    };

    this.alarms = [
      new Alarm(this, 'TargetResponseTimeAlarm', {
        metric: this.metrics.TargetResponseTime,
        threshold: 1,
        evaluationPeriods: 3,
        treatMissingData: TreatMissingData.IGNORE,
        alarmDescription: `${Stack.of(this).stackName} load balancer target response time (TargetResponseTime)`,
      }),
      new Alarm(this, 'RejectedConnectionsAlarm', {
        metric: this.metrics.RejectedConnectionCount,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.IGNORE,
        alarmDescription: `${Stack.of(this).stackName} load balancer rejected connections (RejectedConnectionCount)`,
      }),
      new Alarm(this, 'UnhealthHostAlarm', {
        metric: this.metrics.UnHealthyHostCount,
        threshold: 1,
        evaluationPeriods: 3,
        treatMissingData: TreatMissingData.IGNORE,
        alarmDescription: `${Stack.of(this).stackName} target group unhealthy host count (UnHealthyHostCount)`,
      }),
    ];
  }
}
