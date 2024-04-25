import {
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
  aws_s3 as s3,
  CfnOutput,
  Duration,
  Stack,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types
import { CacclLoadBalancerProps } from '../../../types';

class CacclLoadBalancer extends Construct {
  loadBalancer: elb.ApplicationLoadBalancer;

  httpsListener: elb.ApplicationListener;

  metrics: { [key: string]: cloudwatch.Metric };

  alarms: cloudwatch.Alarm[];

  constructor(scope: Construct, id: string, props: CacclLoadBalancerProps) {
    super(scope, id);

    const {
      vpc,
      securityGroups,
      certificateArn,
      loadBalancerTarget,
      albLogBucketName,
      // includes targetDeregistrationDelay & healthCheckPath which are applied to the ApplicationTargetGroup below
      extraOptions,
    } = props;

    const targetDeregistrationDelay =
      extraOptions?.targetDeregistrationDelay ?? 30;
    const healthCheckPath = extraOptions?.healthCheckPath ?? '/';

    this.loadBalancer = new elb.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      securityGroup: securityGroups.primary,
      internetFacing: true,
    });

    if (securityGroups.misc) {
      this.loadBalancer.addSecurityGroup(securityGroups.misc);
    }

    if (albLogBucketName !== undefined) {
      const bucket = s3.Bucket.fromBucketName(
        this,
        'AlbLogBucket',
        albLogBucketName,
      );
      const objPrefix = Stack.of(this).stackName;
      this.loadBalancer.logAccessLogs(bucket, objPrefix);
    }

    new elb.CfnListener(this, 'HttpRedirect', {
      loadBalancerArn: this.loadBalancer.loadBalancerArn,
      protocol: elb.ApplicationProtocol.HTTP,
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

    const httpsListener = new elb.ApplicationListener(this, 'HttpsListener', {
      loadBalancer: this.loadBalancer,
      certificates: certificateArn ? [{ certificateArn }] : [],
      port: 443,
      protocol: elb.ApplicationProtocol.HTTPS,
      /**
       * if we don't make this false the listener construct will add rules
       * to our security group that we don't want/need
       */
      open: false,
    });

    const atgProps = {
      vpc,
      port: 443,
      protocol: elb.ApplicationProtocol.HTTPS,
      // setting this duration value enables the lb stickiness; 1 day is the default
      stickinessCookieDuration: Duration.seconds(86400),
      targetType: elb.TargetType.IP,
      targets: [loadBalancerTarget],
      deregistrationDelay: Duration.seconds(targetDeregistrationDelay),
      healthCheck: {
        // allow a redirect to indicate service is operational
        healthyHttpCodes: '200,302',
      },
    };

    if (healthCheckPath !== undefined && healthCheckPath !== '/') {
      // this seems like a bonkers way to accomplish inserting an additional k/v pair
      // into a nested object, but eslint complained about every other approach
      atgProps.healthCheck = {
        ...atgProps.healthCheck,
        ...{ path: healthCheckPath },
      };
    }

    const appTargetGroup = new elb.ApplicationTargetGroup(
      this,
      'TargetGroup',
      atgProps,
    );

    httpsListener.addTargetGroups('AppTargetGroup', {
      targetGroups: [appTargetGroup],
    });

    this.metrics = {
      RequestCount: this.loadBalancer.metricRequestCount(),
      NewConnectionCount: this.loadBalancer.metricNewConnectionCount(),
      ActiveConnectionCount: this.loadBalancer.metricActiveConnectionCount(),
      TargetResponseTime: this.loadBalancer
        .metricTargetResponseTime({
          period: Duration.minutes(1),
          unit: cloudwatch.Unit.MILLISECONDS,
          statistic: 'avg',
        })
        .with({ period: Duration.minutes(1) }),
      RejectedConnectionCount: this.loadBalancer
        .metricRejectedConnectionCount({
          period: Duration.minutes(1),
          statistic: 'sum',
        })
        .with({ period: Duration.minutes(1) }),
      UnHealthyHostCount: appTargetGroup
        .metricUnhealthyHostCount({
          period: Duration.minutes(1),
          statistic: 'sum',
        })
        .with({ period: Duration.minutes(1) }),
    };

    this.alarms = [
      new cloudwatch.Alarm(this, 'TargetResponseTimeAlarm', {
        metric: this.metrics.TargetResponseTime,
        threshold: 1,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          Stack.of(this).stackName
        } load balancer target response time (TargetResponseTime)`,
      }),
      new cloudwatch.Alarm(this, 'RejectedConnectionsAlarm', {
        metric: this.metrics.RejectedConnectionCount,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          Stack.of(this).stackName
        } load balancer rejected connections (RejectedConnectionCount)`,
      }),
      new cloudwatch.Alarm(this, 'UnhealthHostAlarm', {
        metric: this.metrics.UnHealthyHostCount,
        threshold: 1,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          Stack.of(this).stackName
        } target group unhealthy host count (UnHealthyHostCount)`,
      }),
    ];

    new CfnOutput(this, 'LoadBalancerHostname', {
      exportName: `${Stack.of(this).stackName}-load-balancer-hostname`,
      value: this.loadBalancer.loadBalancerDnsName,
    });

    if (securityGroups.primary) {
      new CfnOutput(this, 'LoadBalancerPrimarySecurityGroup', {
        exportName: `${Stack.of(this).stackName}-primary-security-group`,
        value: securityGroups.primary.securityGroupId,
      });
    }

    if (securityGroups.misc) {
      new CfnOutput(this, 'LoadBalancerMiscSecurityGroup', {
        exportName: `${Stack.of(this).stackName}-misc-security-group`,
        value: securityGroups.misc.securityGroupId,
      });
    }
  }
}

export default CacclLoadBalancer;
