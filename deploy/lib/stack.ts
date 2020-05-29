import { Stack, Construct, StackProps } from '@aws-cdk/core';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { CacclService } from './service';
import { CacclTaskDef, CacclTaskDefProps } from './taskdef';
import { CacclLoadBalancer } from './lb';
import { CacclDocDb } from './docdb';

export interface CacclDocDbOptions {
  instanceType: string;
}

export interface CacclDeployStackProps extends StackProps {
  vpcId?: string;
  cidrBlock?: string;
  maxAzs?: number;
  certificateArn: string;
  ecsClusterName?: string;
  taskDefProps: CacclTaskDefProps;
  taskCount: number;
  docDbOptions?: CacclDocDbOptions;
}

export class CacclDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CacclDeployStackProps) {
    super(scope, id, props as StackProps);

    let vpc;
    let cluster;

    if (props.vpcId !== undefined) {
      vpc = Vpc.fromLookup(this, 'Vpc', {
        vpcId: props.vpcId,
      }) as Vpc;
    } else if (props.cidrBlock !== undefined) {
      vpc = new Vpc(this, 'Vpc', {
        cidr: props.cidrBlock,
        maxAzs: props.maxAzs || 2,
      });
    } else {
      throw new Error('deployConfig must define either cidrBlock or vpcId');
    }

    if (props.ecsClusterName !== undefined) {
      cluster = Cluster.fromClusterAttributes(this, 'Cluster', {
        vpc,
        clusterName: props.ecsClusterName,
        securityGroups: [],
      }) as Cluster;
    } else {
      cluster = new Cluster(this, 'Cluster', {
        clusterName: props.stackName,
        containerInsights: true,
        vpc,
      });
    }

    const sg = new SecurityGroup(this, 'SecurityGroup', {
      allowAllOutbound: true,
      vpc,
    });

		const taskDef = new CacclTaskDef(this, 'TaskDef', {
      vpcCidrBlock: vpc.vpcCidrBlock,
      ...props.taskDefProps,
    });

    const service = new CacclService(this, 'EcsService', {
      sg,
      cluster,
      taskDef: taskDef,
      taskCount: props.taskCount,
    });

    new CacclLoadBalancer(this, 'LoadBalancer', {
      certificateArn: props.certificateArn,
      loadBalancerTarget: service.loadBalancerTarget,
      vpc,
      sg,
    });

    if (props.docDbOptions !== undefined) {
      const {
        instanceType,
      } = props.docDbOptions;

      new CacclDocDb(this, 'DocDb', {
        instanceType,
        vpc,
      });
    }
  }
}
