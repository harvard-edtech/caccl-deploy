import { DatabaseCluster } from '@aws-cdk/aws-docdb';
import { Vpc, SecurityGroup, BastionHostLinux, SubnetType, Peer, Port, InstanceType } from '@aws-cdk/aws-ec2';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Construct, Stack, CfnOutput, SecretValue } from '@aws-cdk/core';

export interface CacclDocDbProps {
  instanceType: string;
  instanceCount: number;
  vpc: Vpc;
}

export class CacclDocDb extends Construct {
  host: string;

  dbPasswordSecret: Secret;

  dbCluster: DatabaseCluster;

  constructor(scope: Construct, id: string, props: CacclDocDbProps) {
    super(scope, id);

    const { vpc } = props;
    const bastionSg = new SecurityGroup(this, 'BastionSecurityGroup', { vpc });
    bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    const bastionHost = new BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: bastionSg,
    });

    this.dbPasswordSecret = new Secret(this, 'DbPasswordSecret', {
      description: `docdb master user password for ${Stack.of(this).stackName}`,
      generateSecretString: {
        passwordLength: 16,
        excludePunctuation: true,
      },
    });

    this.dbCluster = new DatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
      },
      instances: props.instanceCount,
      instanceProps: {
        vpc,
        instanceType: new InstanceType(props.instanceType),
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      },
    });
    this.host = `${this.dbCluster.clusterEndpoint.hostname}:${this.dbCluster.clusterEndpoint.portAsString()}`;

    // add an ingress rule to the db security group
    const dbSg = SecurityGroup.fromSecurityGroupId(this, 'DocDbSecurityGroup', this.dbCluster.securityGroupId);
    dbSg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(27017));

    new CfnOutput(this, 'DocDbClusterEndpoint', {
      exportName: `${Stack.of(this).stackName}-docdb-cluster-endpoint`,
      value: this.host,
    });

    new CfnOutput(this, 'DocDbSecretArn', {
      exportName: `${Stack.of(this).stackName}-docdb-password-secret-arn`,
      value: this.dbPasswordSecret.secretArn,
    });

    new CfnOutput(this, 'DocDbBastionHostIp', {
      exportName: `${Stack.of(this).stackName}-docdb-bastion-host-ip`,
      value: bastionHost.instancePublicIp,
    });

    new CfnOutput(this, 'DocDbBastionHostId', {
      exportName: `${Stack.of(this).stackName}-docdb-bastion-host-id`,
      value: bastionHost.instanceId,
    });
  }
}
