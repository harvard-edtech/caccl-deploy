// Import aws-sdk
import AWS from 'aws-sdk';

// Import helpers
import getService from './getService.js';

// Types
export type EnvVariable = {
  name: string;
  value: string;
};

export type ExecOptions = {
  clusterName: string;
  command: string;
  environment: EnvVariable[];
  serviceName: string;
  taskDefName: string;
};

/**
 *
 * @author Jay Luker
 * @param {string} execOptions.clusterName
 * @param {string} execOptions.serviceName
 * @param {string} execOptions.taskDefName
 * @param {string} execOptions.command - the command to be executed in
 *  the app container context
 * @param {array} execOptions.environment - an array of environment
 *  variable additions or overrides in the form
 *  { name: <name>, value: <value> }
 * @returns {string} - the arn of the started task
 */
const execTask = async (
  execOptions: ExecOptions,
): Promise<string | undefined> => {
  const ecs = new AWS.ECS();

  const {
    clusterName,
    command,
    environment = [],
    serviceName,
    taskDefName,
  } = execOptions;

  const service = await getService(clusterName, serviceName);

  // re-use networking config from the service description
  const { networkConfiguration } = service;

  const execResp = await ecs
    .runTask({
      cluster: clusterName,
      launchType: 'FARGATE',
      networkConfiguration,
      overrides: {
        containerOverrides: [
          {
            command: ['/bin/sh', '-c', command],
            environment,
            name: 'AppOnlyContainer',
          },
        ],
      },
      platformVersion: '1.3.0',
      taskDefinition: taskDefName,
    })
    .promise();

  if (!execResp.tasks) return undefined;
  return execResp.tasks[0].taskArn;
};

export default execTask;
