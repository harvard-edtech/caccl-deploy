import { aws_ecs as ecs, aws_logs as logs } from 'aws-cdk-lib';

/**
 * Interface for a CDK task definition, with an app container, proxy container, logging config, and Fargate task definition.
 * @author Benedikt Arnarsson
 */
export interface ICacclTaskDef {
  appContainer: ecs.ContainerDefinition;

  appOnlyTaskDef: ecs.FargateTaskDefinition;

  logGroup: logs.LogGroup;

  proxyContainer: ecs.ContainerDefinition;

  taskDef: ecs.FargateTaskDefinition;
}
