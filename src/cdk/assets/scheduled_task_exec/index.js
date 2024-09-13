const aws = require('aws-sdk');

const { ECS_CLUSTER, ECS_SERVICE, ECS_TASK_DEFINITION } = process.env;

const ecs = new aws.ECS();

/**
 * This handler uses the ECS API to execute a one-off run of the app
 * container with an arbitrary command. The default command assumes a django app, but
 * php/artisan commands will also work, e.g., `php artisan migrate`.
 *
 * Note that `ECS_TASK_DEFINITION` should define a task using only the app container (no proxy)
 *
 * @param {object} event
 */
exports.handler = async (event) => {
  const { execCommand = 'python manage.py check' } = event;

  /**
   * Query for the service so that we can copy the
   * network configuration (which is impractical to assemble here)
   */
  const serviceResp = await ecs
    .describeServices({
      cluster: ECS_CLUSTER,
      services: [ECS_SERVICE],
    })
    .promise();
  const service = serviceResp.services[0];

  const { networkConfiguration } = service;

  const execResp = await ecs
    .runTask({
      cluster: ECS_CLUSTER,
      launchType: 'FARGATE',
      networkConfiguration,
      overrides: {
        containerOverrides: [
          {
            command: ['/bin/sh', '-c', execCommand],
            name: 'AppOnlyContainer',
          },
        ],
      },
      platformVersion: '1.4.0',
      taskDefinition: ECS_TASK_DEFINITION,
    })
    .promise();
  const { taskArn } = execResp.tasks[0];
  console.log(`Task ${taskArn} started`);
};
