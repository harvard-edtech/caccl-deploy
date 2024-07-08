import {
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
} from 'aws-cdk-lib';

// TODO: JSDoc
interface ICacclLoadBalancer {
  loadBalancer: elb.ApplicationLoadBalancer;

  httpsListener: elb.ApplicationListener;

  metrics: Record<string, cloudwatch.Metric>;

  alarms: cloudwatch.Alarm[];
}

export default ICacclLoadBalancer;
