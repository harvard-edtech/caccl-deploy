// Import AWS CDK lib
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

// Import types
import CacclScheduledTask from './CacclScheduledTask.js';

type CacclScheduledTasksProps = {
  clusterName: string;
  scheduledTasks: { [key: string]: CacclScheduledTask };
  serviceName: string;
  taskDefinition: ecs.FargateTaskDefinition;
  vpc: ec2.Vpc;
};

export default CacclScheduledTasksProps;
