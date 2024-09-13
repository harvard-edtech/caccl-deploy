import { aws_ecs as ecs, aws_logs as logs } from 'aws-cdk-lib';

interface ICacclTaskDef {
  appContainer: ecs.ContainerDefinition;

  appOnlyTaskDef: ecs.FargateTaskDefinition;

  logGroup: logs.LogGroup;

  proxyContainer: ecs.ContainerDefinition;

  taskDef: ecs.FargateTaskDefinition;
}

export default ICacclTaskDef;
