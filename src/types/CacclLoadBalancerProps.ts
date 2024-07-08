// Import AWS CDK lib
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

// Import types
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';
import LoadBalancerSecurityGroups from './LoadBalancerSecurityGroups.js';

// TODO: JSDoc
type CacclLoadBalancerProps = {
  vpc: ec2.Vpc;
  securityGroups: LoadBalancerSecurityGroups;
  certificateArn?: string;
  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;
  albLogBucketName?: string;
  extraOptions?: CacclLoadBalancerExtraOptions;
  targetDeregistrationDelay?: number; // in seconds
};

export default CacclLoadBalancerProps;
