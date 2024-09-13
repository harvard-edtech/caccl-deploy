// Import AWS CDK lib
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

type LoadBalancerSecurityGroups = {
  misc?: ec2.SecurityGroup;
  primary?: ec2.SecurityGroup;
};

export default LoadBalancerSecurityGroups;
