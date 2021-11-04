const aws = require('aws-sdk')

const ECS_CLUSTER = process.env.ECS_CLUSTER;
const ECS_SERVICE = process.env.ECS_SERVICE;
const ECS_TASK_DEFINITION = process.env.ECS_TASK_DEFINITION;

const ecs = new aws.ECS();

exports.handler = async (event, context) => {
  const { execCommand = 'python manage.py check' } = event;

  const serviceResp = await ecs
    .describeServices({
      cluster: ECS_CLUSTER,
      services: [ECS_SERVICE],
    }).promise();
  const service = serviceResp.services[0];

  const { networkConfiguration } = service;

  const execResp = await ecs.runTask({
    cluster: ECS_CLUSTER,
    taskDefinition: ECS_TASK_DEFINITION,
    networkConfiguration,
    launchType: 'FARGATE',
    platformVersion: '1.3.0',
    overrides: {
      containerOverrides: [
        {
          name: 'AppOnlyContainer',
          command: ['/bin/sh', '-c', execCommand],
        }
      ],
    },
  }).promise();
  const { taskArn } = execResp.tasks[0];
  console.log(`Task ${taskArn} started`);
}
