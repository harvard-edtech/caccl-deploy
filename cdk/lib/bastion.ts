import { aws_ec2 as ec2, Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface CacclSshBastionProps {
  vpc: ec2.Vpc;
  sg: ec2.SecurityGroup;
  bastionAmiId: string;
}

export class CacclSshBastion extends Construct {
  instance: ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props: CacclSshBastionProps) {
    super(scope, id);

    const { vpc, sg, bastionAmiId } = props;

    const machineImage = ec2.MachineImage.genericLinux({
      [Stack.of(this).region]: bastionAmiId,
    });

    const machineImage = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
    });

    this.instance = new ec2.BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: sg,
      machineImage,
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
