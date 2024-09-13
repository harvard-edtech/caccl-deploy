import {
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
} from 'aws-cdk-lib';

interface ICacclLoadBalancer {
  alarms: cloudwatch.Alarm[];

  httpsListener: elb.ApplicationListener;

  loadBalancer: elb.ApplicationLoadBalancer;

  metrics: Record<string, cloudwatch.Metric>;
}

export default ICacclLoadBalancer;
