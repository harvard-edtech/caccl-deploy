// Import AWS CDK lib
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

// Import types
import ICacclTaskDef from './ICacclTaskDef.js';

type CacclServiceProps = {
  cluster: ecs.Cluster;
  enableExecuteCommand?: boolean;
  loadBalancerSg: ec2.SecurityGroup;
  taskCount: number;
  taskDef: ICacclTaskDef;
};

export default CacclServiceProps;
