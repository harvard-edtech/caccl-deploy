import {
  CfnOutput,
  Duration,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types
import { CacclLoadBalancerProps } from '../../../types/index.js';

class CacclLoadBalancer extends Construct {
  alarms: cloudwatch.Alarm[];

  httpsListener: elb.ApplicationListener;

  loadBalancer: elb.ApplicationLoadBalancer;

  metrics: { [key: string]: cloudwatch.Metric };

  constructor(scope: Construct, id: string, props: CacclLoadBalancerProps) {
    super(scope, id);

    const {
      albLogBucketName,
      certificateArn,
      // includes targetDeregistrationDelay & healthCheckPath which are applied to the ApplicationTargetGroup below
      extraOptions,
      loadBalancerTarget,
      securityGroups,
      vpc,
    } = props;

    const targetDeregistrationDelay =
      extraOptions?.targetDeregistrationDelay ?? 30;
    const healthCheckPath = extraOptions?.healthCheckPath ?? '/';

    this.loadBalancer = new elb.ApplicationLoadBalancer(this, 'LoadBalancer', {
      internetFacing: true,
      securityGroup: securityGroups.primary,
      vpc,
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
      defaultActions: [
        {
          redirectConfig: {
            host: '#{host}',
            path: '/#{path}',
            port: '443',
            protocol: 'HTTPS',
            query: '#{query}',
            statusCode: 'HTTP_301',
          },
          type: 'redirect',
        },
      ],
      loadBalancerArn: this.loadBalancer.loadBalancerArn,
      port: 80,
      protocol: elb.ApplicationProtocol.HTTP,
    });

    const httpsListener = new elb.ApplicationListener(this, 'HttpsListener', {
      certificates: certificateArn ? [{ certificateArn }] : [],
      loadBalancer: this.loadBalancer,
      /**
       * if we don't make this false the listener construct will add rules
       * to our security group that we don't want/need
       */
      open: false,
      port: 443,
      protocol: elb.ApplicationProtocol.HTTPS,
    });

    const atgProps = {
      deregistrationDelay: Duration.seconds(targetDeregistrationDelay),
      healthCheck: {
        // allow a redirect to indicate service is operational
        healthyHttpCodes: '200,302',
      },
      port: 443,
      protocol: elb.ApplicationProtocol.HTTPS,
      // setting this duration value enables the lb stickiness; 1 day is the default
      stickinessCookieDuration: Duration.seconds(86_400),
      targetType: elb.TargetType.IP,
      targets: [loadBalancerTarget],
      vpc,
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
      ActiveConnectionCount: this.loadBalancer.metricActiveConnectionCount(),
      NewConnectionCount: this.loadBalancer.metricNewConnectionCount(),
      RejectedConnectionCount: this.loadBalancer
        .metricRejectedConnectionCount({
          period: Duration.minutes(1),
          statistic: 'sum',
        })
        .with({ period: Duration.minutes(1) }),
      RequestCount: this.loadBalancer.metricRequestCount(),
      TargetResponseTime: this.loadBalancer
        .metricTargetResponseTime({
          period: Duration.minutes(1),
          statistic: 'avg',
          unit: cloudwatch.Unit.MILLISECONDS,
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
        alarmDescription: `${
          Stack.of(this).stackName
        } load balancer target response time (TargetResponseTime)`,
        evaluationPeriods: 3,
        metric: this.metrics.TargetResponseTime,
        threshold: 1,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
      }),
      new cloudwatch.Alarm(this, 'RejectedConnectionsAlarm', {
        alarmDescription: `${
          Stack.of(this).stackName
        } load balancer rejected connections (RejectedConnectionCount)`,
        evaluationPeriods: 1,
        metric: this.metrics.RejectedConnectionCount,
        threshold: 1,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
      }),
      new cloudwatch.Alarm(this, 'UnhealthHostAlarm', {
        alarmDescription: `${
          Stack.of(this).stackName
        } target group unhealthy host count (UnHealthyHostCount)`,
        evaluationPeriods: 3,
        metric: this.metrics.UnHealthyHostCount,
        threshold: 1,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
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
