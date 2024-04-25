// Import AWS CDK lib
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

// Import types
import ICacclTaskDef from './ICacclTaskDef';

type CacclServiceProps = {
  cluster: ecs.Cluster;
  taskDef: ICacclTaskDef;
  taskCount: number;
  loadBalancerSg: ec2.SecurityGroup;
  enableExecuteCommand?: boolean;
};

export default CacclServiceProps;
