import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

import type { LoadBalancerSecurityGroups } from './LoadBalancerSecurityGroups.js';

import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';

/**
 * Properties for load balancers deployed with caccl-deploy.
 * @author Benedikt Arnarsson
 */
export type CacclLoadBalancerProps = {
  albLogBucketName?: string;
  certificateArn?: string;
  extraOptions?: CacclLoadBalancerExtraOptions;
  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;
  securityGroups: LoadBalancerSecurityGroups;
  targetDeregistrationDelay?: number; // in seconds
  vpc: ec2.Vpc;
};
