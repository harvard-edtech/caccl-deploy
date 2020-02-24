import { Construct } from '@aws-cdk/core';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Vpc } from '@aws-cdk/aws-ec2';

export interface ClusterProps {
  vpc: Vpc,
};

export class ClusterConstruct extends Construct {

  readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: ClusterProps) {
    super(scope, id);

    this.cluster = new Cluster(this, 'EcsCluster', {
      vpc: props.vpc,
      containerInsights: true,
    });
  }
};
