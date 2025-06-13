import {
  DescribeTaskDefinitionCommand,
  ECSClient,
  TaskDefinition,
} from '@aws-sdk/client-ecs';

/**
 * Fetches the data for an ECS task definition
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} taskDefName name of the task definition whose info we are fetching.
 * @param {string} [profile='default'] AWS profile
 * @returns {TaskDefinition} information about the task definition.
 */
const getTaskDefinition = async (
  taskDefName: string,
  profile = 'default',
): Promise<TaskDefinition> => {
  const client = new ECSClient({ profile });
  const command = new DescribeTaskDefinitionCommand({
    taskDefinition: taskDefName,
  });
  const resp = await client.send(command);

  if (resp.taskDefinition === undefined) {
    throw new Error(`task def ${taskDefName} not found`);
  }

  return resp.taskDefinition;
};

export default getTaskDefinition;
