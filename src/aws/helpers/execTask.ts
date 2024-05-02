// Import aws-sdk
import AWS from 'aws-sdk';

// Import helpers
import getService from './getService';

// Types
export type EnvVariable = {
  name: string;
  value: string;
};

export type ExecOptions = {
  clusterName: string;
  serviceName: string;
  taskDefName: string;
  command: string;
  environment: EnvVariable[];
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
    serviceName,
    taskDefName,
    command,
    environment = [],
  } = execOptions;

  const service = await getService(clusterName, serviceName);

  // re-use networking config from the service description
  const { networkConfiguration } = service;

  const execResp = await ecs
    .runTask({
      cluster: clusterName,
      taskDefinition: taskDefName,
      networkConfiguration,
      launchType: 'FARGATE',
      platformVersion: '1.3.0',
      overrides: {
        containerOverrides: [
          {
            name: 'AppOnlyContainer',
            command: ['/bin/sh', '-c', command],
            environment,
          },
        ],
      },
    })
    .promise();

  if (!execResp.tasks) return undefined;
  return execResp.tasks[0].taskArn;
};

export default execTask;
