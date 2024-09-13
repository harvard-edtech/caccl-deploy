// Import AWS cdk-lib
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

type CacclSshBastionProps = {
  sg: ec2.SecurityGroup;
  vpc: ec2.Vpc;
};

export default CacclSshBastionProps;
