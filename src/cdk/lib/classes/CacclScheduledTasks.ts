// Import NodeJS libs
import {
  CfnOutput,
  Duration,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_events as events,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_events_targets as targets,
} from 'aws-cdk-lib';
// Import AWS constructs
import { Construct } from 'constructs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Import AWS CDK lib

// Import shared types
import { type CacclScheduledTasksProps } from '../../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TODO: JSDOC
class CacclScheduledTasks extends Construct {
  alarms: cloudwatch.Alarm[] = [];

  eventRules: events.Rule[] = [];

  taskExecFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: CacclScheduledTasksProps) {
    super(scope, id);

    const { account, region, stackName } = Stack.of(this);

    const { clusterName, scheduledTasks, serviceName, taskDefinition, vpc } =
      props;

    this.taskExecFunction = new lambda.Function(
      this,
      'ScheduledTaskExecFunction',
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../assets/scheduled_task_exec'),
        ),
        environment: {
          ECS_CLUSTER: clusterName,
          ECS_SERVICE: serviceName,
          ECS_TASK_DEFINITION: taskDefinition.family,
        },
        functionName: `${stackName}-scheduled-task-exec`,
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      },
    );

    // create a cloudwatch event rule for each configured task
    for (const scheduledTaskId of Object.keys(scheduledTasks)) {
      const scheduledTask = scheduledTasks[scheduledTaskId];

      if (scheduledTask === undefined) {
        throw new Error(
          `scheduledTasks.${scheduledTaskId} is undefined. Please check your deployConfig.`,
        );
      }

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
          description: scheduledTask.description,
          ruleName,
          schedule,
          targets: [eventTarget],
        },
      );
      this.eventRules.push(eventRule);
    }

    // function needs to read various ecs stuff
    this.taskExecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:Describe*', 'ecs:List*'],
        effect: iam.Effect.ALLOW,
        resources: ['*'],
      }),
    );

    // function needs to be able to run our task
    this.taskExecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        effect: iam.Effect.ALLOW,
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
        actions: ['iam:PassRole'],
        effect: iam.Effect.ALLOW,
        resources: passRoleArns,
      }),
    );

    this.alarms = [
      // alarm on any function errors
      new cloudwatch.Alarm(this, 'ErrorAlarm', {
        alarmDescription: `${stackName} scheduled task execution error alarm`,
        evaluationPeriods: 1,
        metric: this.taskExecFunction
          .metricErrors()
          .with({ period: Duration.minutes(5) }),
        threshold: 1,
      }),
      // alarm if function isn't invoked at least once per day
      new cloudwatch.Alarm(this, 'InvocationsAlarm', {
        alarmDescription: `${stackName} no invocations alarm`,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        evaluationPeriods: 1,
        metric: this.taskExecFunction
          .metricInvocations()
          .with({ period: Duration.days(1) }),
        threshold: 1,
      }),
    ];

    new CfnOutput(this, 'DeployConfigHash', {
      exportName: `${stackName}-scheduled-tasks-function-name`,
      value: this.taskExecFunction.functionName,
    });
  }
}

export default CacclScheduledTasks;
