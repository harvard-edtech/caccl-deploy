// Import AWS CDK lib
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

// Import types
import CacclScheduledTask from './CacclScheduledTask';

// TODO: JSDoc
type CacclScheduledTasksProps = {
  vpc: ec2.Vpc;
  scheduledTasks: { [key: string]: CacclScheduledTask };
  clusterName: string;
  serviceName: string;
  taskDefinition: ecs.FargateTaskDefinition;
};

export default CacclScheduledTasksProps;
