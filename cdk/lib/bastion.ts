import { aws_ec2 as ec2, Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// TODO: this will need to be expanded if this project is to be used outside of DCE
const DEFAULT_AMI_MAP = {
  // this value should be updated on a regular basis.
  // the latest amazon linux ami is recorded in the public parameter store entry
  // /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2
  'us-east-1': 'ami-02b972fec07f1e659',
};

export interface CacclSshBastionProps {
  vpc: ec2.Vpc;
  sg: ec2.SecurityGroup;
}

export class CacclSshBastion extends Construct {
  instance: ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props: CacclSshBastionProps) {
    super(scope, id);

    const { vpc, sg } = props;

    this.instance = new ec2.BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: sg,
      machineImage: ec2.MachineImage.genericLinux(DEFAULT_AMI_MAP),
    });

    new CfnOutput(this, 'DbBastionHostIp', {
      exportName: `${Stack.of(this).stackName}-bastion-host-ip`,
      value: this.instance.instancePublicIp,
    });

    new CfnOutput(this, 'DbBastionHostId', {
      exportName: `${Stack.of(this).stackName}-bastion-host-id`,
      value: this.instance.instanceId,
    });

    new CfnOutput(this, 'DbBastionHostAZ', {
      exportName: `${Stack.of(this).stackName}-bastion-host-az`,
      value: this.instance.instanceAvailabilityZone,
    });

    new CfnOutput(this, 'DbBastionSecurityGroupId', {
      exportName: `${Stack.of(this).stackName}-bastion-security-group-id`,
      value: sg.securityGroupId,
    });
  }
}
