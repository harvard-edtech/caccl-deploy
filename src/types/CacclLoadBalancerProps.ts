// Import AWS CDK lib
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

// Import types
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';
import LoadBalancerSecurityGroups from './LoadBalancerSecurityGroups.js';

type CacclLoadBalancerProps = {
  albLogBucketName?: string;
  certificateArn?: string;
  extraOptions?: CacclLoadBalancerExtraOptions;
  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;
  securityGroups: LoadBalancerSecurityGroups;
  targetDeregistrationDelay?: number; // in seconds
  vpc: ec2.Vpc;
};

export default CacclLoadBalancerProps;
