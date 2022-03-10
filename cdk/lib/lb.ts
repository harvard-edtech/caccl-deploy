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
import { CfnOutput, Construct, Duration, Stack } from '@aws-cdk/core';

export type LoadBalancerSecurityGoups = {
  primary?: SecurityGroup;
  misc?: SecurityGroup;
};

export interface CacclLoadBalancerProps {
  vpc: Vpc;
  securityGroups: LoadBalancerSecurityGoups;
  certificateArn: string;
  loadBalancerTarget: IEcsLoadBalancerTarget;
  albLogBucketName?: string;
  targetDeregistrationDelay?: number; // in seconds
}

export class CacclLoadBalancer extends Construct {
  loadBalancer: ApplicationLoadBalancer;

  httpsListener: ApplicationListener;

  metrics: { [key: string]: Metric; };

  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclLoadBalancerProps) {
    super(scope, id);

    const {
      vpc,
      securityGroups,
      certificateArn,
      loadBalancerTarget,
      albLogBucketName,
      targetDeregistrationDelay = 30,
    } = props;

    this.loadBalancer = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      securityGroup: securityGroups.primary,
      internetFacing: true,
    });

    if (securityGroups.misc) {
      this.loadBalancer.addSecurityGroup(securityGroups.misc);
    }

    if (albLogBucketName !== undefined) {
      const bucket = Bucket.fromBucketName(this, 'AlbLogBucket', albLogBucketName);
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
      /**
       * if we don't make this false the listener construct will add rules
       * to our security group that we don't want/need
       */
      open: false,
    });

    const appTargetGroup = new ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      // setting this duration value enables the lb stickiness; 1 day is the default
      stickinessCookieDuration: Duration.seconds(86400),
      deregistrationDelay: Duration.seconds(targetDeregistrationDelay),
      targetType: TargetType.IP,
      targets: [loadBalancerTarget],
      healthCheck: {
        // allow a redirect to indicate service is operational
        healthyHttpCodes: '200,302',
      },
    });

    httpsListener.addTargetGroups('AppTargetGroup', {
      targetGroups: [appTargetGroup],
    });

    this.metrics = {
      RequestCount: this.loadBalancer.metricRequestCount(),
      NewConnectionCount: this.loadBalancer.metricNewConnectionCount(),
      ActiveConnectionCount: this.loadBalancer.metricActiveConnectionCount(),
      TargetResponseTime: this.loadBalancer.metricTargetResponseTime({
        period: Duration.minutes(1),
        unit: Unit.MILLISECONDS,
        statistic: 'avg',
      }).with({ period: Duration.minutes(1) }),
      RejectedConnectionCount: this.loadBalancer.metricRejectedConnectionCount({
        period: Duration.minutes(1),
        statistic: 'sum',
      }).with({ period: Duration.minutes(1) }),
      UnHealthyHostCount: appTargetGroup.metricUnhealthyHostCount({
        period: Duration.minutes(1),
        statistic: 'sum',
      }).with({ period: Duration.minutes(1) }),
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

    new CfnOutput(this, 'LoadBalancerHostname', {
      exportName: `${Stack.of(this).stackName}-load-balancer-hostname`,
      value: this.loadBalancer.loadBalancerDnsName,
    });

    new CfnOutput(this, 'LoadBalancerPrimarySecurityGroup', {
      exportName: `${Stack.of(this).stackName}-primary-security-group`,
      value: securityGroups.primary!.securityGroupId,
    });

    if (securityGroups.misc) {
      new CfnOutput(this, 'LoadBalancerMiscSecurityGroup', {
        exportName: `${Stack.of(this).stackName}-misc-security-group`,
        value: securityGroups.misc.securityGroupId,
      });
    }
  }
}
