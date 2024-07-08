import { aws_ecs as ecs, aws_logs as logs } from 'aws-cdk-lib';

interface ICacclTaskDef {
  taskDef: ecs.FargateTaskDefinition;

  appOnlyTaskDef: ecs.FargateTaskDefinition;

  proxyContainer: ecs.ContainerDefinition;

  appContainer: ecs.ContainerDefinition;

  logGroup: logs.LogGroup;
}

export default ICacclTaskDef;
