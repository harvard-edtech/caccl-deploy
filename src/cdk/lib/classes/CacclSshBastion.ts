import { CfnOutput, Stack, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types
import { type CacclSshBastionProps } from '../../../types/index.js';
// Import constants
import DEFAULT_AMI_MAP from '../constants/DEFAULT_AMI_MAP.js';

class CacclSshBastion extends Construct {
  instance: ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props: CacclSshBastionProps) {
    super(scope, id);

    const { sg, vpc } = props;

    this.instance = new ec2.BastionHostLinux(this, 'SshBastionHost', {
      instanceName: `${Stack.of(this).stackName}-bastion`,
      machineImage: ec2.MachineImage.genericLinux(DEFAULT_AMI_MAP),
      securityGroup: sg,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
      vpc,
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

export default CacclSshBastion;
