import { Construct, Stack, CfnOutput } from '@aws-cdk/core';
import { Vpc, SecurityGroup, BastionHostLinux, SubnetType, Peer, Port, InstanceType } from '@aws-cdk/aws-ec2';
import { DatabaseCluster } from '@aws-cdk/aws-docdb';

export interface CacclDocDbProps {
  instanceType: string;
  vpc: Vpc;
}

export class CacclDocDb extends Construct {
  constructor(scope: Construct, id: string, props: CacclDocDbProps) {
    super(scope, id);

    const { vpc } = props;
    const bastionSg = new SecurityGroup(this, 'BastionSecurityGroup', { vpc });
    bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    new BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: bastionSg,
    });

    const dbCluster = new DatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
      },
      instanceProps: {
        vpc,
        instanceType: new InstanceType(props.instanceType),
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      },
    });

    new CfnOutput(this, 'DocDbClusterEndpoint', {
      exportName: `${Stack.of(this).stackName}-docdb-cluster-endpoint`,
      value: dbCluster.clusterEndpoint.hostname,
    });

    if (dbCluster.secret !== undefined) {
      new CfnOutput(this, 'DocDbPasswordSecretArn', {
        exportName: `${Stack.of(this).stackName}-docdb-password-secret-arn`,
        value: dbCluster.secret.secretArn,
      });
    }
  }
}
