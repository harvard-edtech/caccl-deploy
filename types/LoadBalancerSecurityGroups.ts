// Import AWS CDK lib
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

// TODO: JSDoc
type LoadBalancerSecurityGroups = {
  primary?: ec2.SecurityGroup;
  misc?: ec2.SecurityGroup;
};

export default LoadBalancerSecurityGroups;
