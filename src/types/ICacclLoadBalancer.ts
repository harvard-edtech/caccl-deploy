import {
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
} from 'aws-cdk-lib';

/**
 * Interface for a generic CDK load balancer, allowing alarms and metrics.
 * @author Benedikt Arnarsson
 */
interface ICacclLoadBalancer {
  alarms: cloudwatch.Alarm[];

  httpsListener: elb.ApplicationListener;

  loadBalancer: elb.ApplicationLoadBalancer;

  metrics: Record<string, cloudwatch.Metric>;
}

export default ICacclLoadBalancer;
