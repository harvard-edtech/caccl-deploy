import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';

import CacclScheduledTask from './CacclScheduledTask.js';

/**
 * Properties for constructing a CDK scheduled task with CACCL deploy.
 * @author Benedikt Arnarsson
 */
export type CacclScheduledTasksProps = {
  clusterName: string;
  scheduledTasks: { [key: string]: CacclScheduledTask };
  serviceName: string;
  taskDefinition: ecs.FargateTaskDefinition;
  vpc: ec2.Vpc;
};
