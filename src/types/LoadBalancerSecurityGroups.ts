import { aws_ec2 as ec2 } from 'aws-cdk-lib';

/**
 * Security group configuration for load balancers.
 * @author Benedikt Arnarsson
 */
type LoadBalancerSecurityGroups = {
  misc?: ec2.SecurityGroup;
  primary?: ec2.SecurityGroup;
};

export default LoadBalancerSecurityGroups;
