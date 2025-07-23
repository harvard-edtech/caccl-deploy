import { aws_ec2 as ec2 } from 'aws-cdk-lib';

/**
 * Properties to configure a CDK bastion with CACCL deploy.
 * @author Benedikt Arnarsson
 */
export type CacclSshBastionProps = {
  sg: ec2.SecurityGroup;
  vpc: ec2.Vpc;
};
