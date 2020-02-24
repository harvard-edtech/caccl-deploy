import { Construct } from '@aws-cdk/core';
import {
  Vpc,
  Peer,
  Port,
  SubnetType,
  SecurityGroup,
} from '@aws-cdk/aws-ec2';

export interface VpcProps {
  cidrBlock: string,
}

export class VpcConstruct extends Construct {

  readonly vpc: Vpc;
  readonly securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      cidr: props.cidrBlock,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'dce-cdk-deploy-public-subnet',
          subnetType: SubnetType.PUBLIC,
        },
        {
          name: 'dce-cdk-deploy-private-subnet',
          subnetType: SubnetType.PRIVATE,
        },
      ],
    });

    this.securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
    })

    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
    this.securityGroup.addIngressRule(this.securityGroup, Port.tcp(80));
    this.securityGroup.addIngressRule(this.securityGroup, Port.tcp(443))
  }
};
