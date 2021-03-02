import { Vpc, SecurityGroup, BastionHostLinux, SubnetType, Peer, Port } from '@aws-cdk/aws-ec2';
import { Construct, Stack, CfnOutput } from '@aws-cdk/core';

export interface CacclSshBastionProps {
  vpc: Vpc,
};

export class CacclSshBastion extends Construct {
  instance: BastionHostLinux;
  sg: SecurityGroup;

  constructor(scope: Construct, id: string, props: CacclSshBastionProps) {
    super(scope, id);

    const { vpc } = props;

    this.sg = new SecurityGroup(this, 'BastionSecurityGroup', { vpc });
    this.sg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    this.instance = new BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: this.sg
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

  }
};
