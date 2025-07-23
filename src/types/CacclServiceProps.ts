import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

import type { ICacclTaskDef } from './ICacclTaskDef.js';

/**
 * Properties for constructing a CDK service with CACCL deploy.
 * @author Benedikt Arnarsson
 */
export type CacclServiceProps = {
  cluster: ecs.Cluster;
  enableExecuteCommand?: boolean;
  loadBalancerSg: ec2.SecurityGroup;
  taskCount: number;
  taskDef: ICacclTaskDef;
};
