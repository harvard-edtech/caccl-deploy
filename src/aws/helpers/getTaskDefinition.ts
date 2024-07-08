// Import aws-sdk
import AWS, { ECS } from 'aws-sdk';

/**
 * Fetches the data for an ECS task definition
 * @author Jay Luker
 * @param {string} taskDefName
 * @returns {string}
 */
const getTaskDefinition = async (
  taskDefName: string,
): Promise<ECS.TaskDefinition> => {
  const ecs = new AWS.ECS();
  const resp = await ecs
    .describeTaskDefinition({
      taskDefinition: taskDefName,
    })
    .promise();

  if (resp.taskDefinition === undefined) {
    throw new Error(`task def ${taskDefName} not found`);
  }

  return resp.taskDefinition;
};

export default getTaskDefinition;
