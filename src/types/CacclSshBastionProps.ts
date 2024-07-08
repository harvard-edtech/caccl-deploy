// Import AWS cdk-lib
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

// TODO: JSDoc
type CacclSshBastionProps = {
  vpc: ec2.Vpc;
  sg: ec2.SecurityGroup;
};

export default CacclSshBastionProps;
