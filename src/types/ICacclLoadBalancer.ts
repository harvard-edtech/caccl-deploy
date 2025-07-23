import {
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elb,
} from 'aws-cdk-lib';

/**
 * Interface for a generic CDK load balancer, allowing alarms and metrics.
 * @author Benedikt Arnarsson
 */
export interface ICacclLoadBalancer {
  alarms: cloudwatch.Alarm[];

  loadBalancer: elb.ApplicationLoadBalancer;

  metrics: Record<string, cloudwatch.Metric>;
}
