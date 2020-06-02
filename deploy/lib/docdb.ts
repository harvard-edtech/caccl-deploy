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
    const sg = new SecurityGroup(this, 'DocDbSecurityGroup', { vpc });

    const sshBastion = new BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: sg,
    });
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));
    sg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(27017));

    const dbCluster = new DatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
      },
      instanceProps: {
        vpc,
        instanceType: new InstanceType(props.instanceType),
        securityGroup: sg,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      },
    });

    // this should ensure the cluster is deleted prior to the security group;
    // otherwise cloudformation will try to delete the security group frist and
    // end up throwing a dependent resource error
    dbCluster.node.addDependency(sg);
    sshBastion.node.addDependency(sg);

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
