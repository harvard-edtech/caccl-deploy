import path from 'path';
import {
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  CfnOutput,
  Stack,
  Duration,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface CacclScheduledTask {
  description?: string;
  schedule: string;
  command: string;
}

export interface CacclScheduledTasksProps {
  vpc: ec2.Vpc;
  scheduledTasks: { [key: string]: CacclScheduledTask };
  clusterName: string;
  serviceName: string;
  taskDefinition: ecs.FargateTaskDefinition;
}

export class CacclScheduledTasks extends Construct {
  taskExecFunction: lambda.Function;

  eventRules: events.Rule[] = [];

  alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: CacclScheduledTasksProps) {
    super(scope, id);

    const { stackName, region, account } = Stack.of(this);

    const { clusterName, serviceName, taskDefinition, vpc, scheduledTasks } =
      props;

    this.taskExecFunction = new lambda.Function(
      this,
      'ScheduledTaskExecFunction',
      {
        functionName: `${stackName}-scheduled-task-exec`,
        runtime: lambda.Runtime.NODEJS_12_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '..', 'assets/scheduled_task_exec'),
        ),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        environment: {
          ECS_CLUSTER: clusterName,
          ECS_SERVICE: serviceName,
          ECS_TASK_DEFINITION: taskDefinition.family,
        },
      },
    );

    // create a cloudwatch event rule for each configured task
    Object.keys(scheduledTasks).forEach((scheduledTaskId) => {
      const scheduledTask = scheduledTasks[scheduledTaskId];
      // the target is always our lambda function, but with variable commands to execute the task with
      // e.g., "python manage.py some-recurring-job"
      const eventTarget = new targets.LambdaFunction(this.taskExecFunction, {
        // this is the json event object that the lambda function receives
        event: events.RuleTargetInput.fromObject({
          execCommand: scheduledTask.command,
        }),
      });
      const schedule = events.Schedule.expression(
        `cron(${scheduledTask.schedule})`,
      );
      const ruleName = `${Stack.of(this)}-scheduled-task-${scheduledTaskId}`;
      const eventRule = new events.Rule(
        this,
        `ScheduledTaskEventRule${scheduledTaskId}`,
        {
          ruleName,
          schedule,
          targets: [eventTarget],
          description: scheduledTask.description,
        },
      );
      this.eventRules.push(eventRule);
    });

    // function needs to read various ecs stuff
    this.taskExecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecs:Describe*', 'ecs:List*'],
        resources: ['*'],
      }),
    );

    // function needs to be able to run our task
    this.taskExecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecs:RunTask'],
        resources: [
          `arn:aws:ecs:${region}:${account}:task-definition/${taskDefinition.family}`,
        ],
      }),
    );

    // function needs to be able to pass these roles to ECS
    const passRoleArns = [taskDefinition.taskRole.roleArn];
    if (taskDefinition.executionRole) {
      passRoleArns.push(taskDefinition.executionRole.roleArn);
    }
    this.taskExecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: passRoleArns,
      }),
    );

    this.alarms = [
      // alarm on any function errors
      new cloudwatch.Alarm(this, 'ErrorAlarm', {
        metric: this.taskExecFunction
          .metricErrors()
          .with({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${stackName} scheduled task execution error alarm`,
      }),
      // alarm if function isn't invoked at least once per day
      new cloudwatch.Alarm(this, 'InvocationsAlarm', {
        metric: this.taskExecFunction
          .metricInvocations()
          .with({ period: Duration.days(1) }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${stackName} no invocations alarm`,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      }),
    ];

    new CfnOutput(this, 'DeployConfigHash', {
      exportName: `${stackName}-scheduled-tasks-function-name`,
      value: this.taskExecFunction.functionName,
    });
  }
}
