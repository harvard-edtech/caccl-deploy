import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';

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
  profile?: string;
  serviceName: string;
  taskDefName: string;
};

/**
 * Execute a command on the specified ECS instance.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {ExecOptions} execOptions the options for execTask.
 * @param {string} execOptions.clusterName name of the cluster which will execute the command.
 * @param {string} execOptions.serviceName name of the service which will execute the command.
 * @param {string} execOptions.taskDefName name of the task definition which will execute the command.
 * @param {string} execOptions.command - the command to be executed in
 *  the app container context
 * @param {array} execOptions.environment - an array of environment
 *  variable additions or overrides in the form
 *  { name: <name>, value: <value> }
 * @param {string} [execOptions.profile='default'] AWS profile to use.
 * @returns {string} - the arn of the started task
 */
const execTask = async (
  execOptions: ExecOptions,
): Promise<string | undefined> => {
  const {
    clusterName,
    command,
    environment = [],
    profile = 'default',
    serviceName,
    taskDefName,
  } = execOptions;

  const client = new ECSClient({ profile });

  const service = await getService(clusterName, serviceName, profile);

  // re-use networking config from the service description
  const { networkConfiguration } = service;

  const runTaskCommand = new RunTaskCommand({
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
  });
  const execResp = await client.send(runTaskCommand);

  if (!execResp.tasks) return undefined;
  return execResp.tasks[0].taskArn;
};

export default execTask;
