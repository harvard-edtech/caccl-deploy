// Import aws-sdk
import AWS from 'aws-sdk';

// Import helpers
import ecrArnToImageId from './ecrArnToImageId.js';
import getTaskDefinition from './getTaskDefinition.js';

/**
 * Updates a Fargate task definition, replacing the app container's
 *   ECR image URI value
 * @author Jay Luker
 * @param {string} taskDefName
 * @param {string} imageArn
 * @returns {string} - the full ARN (incl family:revision) of the newly
 *   registered task definition
 */
const updateTaskDefAppImage = async (
  taskDefName: string,
  imageArn: string,
  containerDefName: string,
): Promise<string | undefined> => {
  const ecs = new AWS.ECS();
  const taskDefinition = await getTaskDefinition(taskDefName);
  if (!taskDefinition.taskDefinitionArn)
    throw new Error('Could not get task definition ARN');

  // get existing tag set to include with the new task def
  const tagResp = await ecs
    .listTagsForResource({
      resourceArn: taskDefinition.taskDefinitionArn,
    })
    .promise();

  /**
   * tasks have multiple container definitions (app, proxy, etc), so we need
   * to get the index for the one we're changing ('AppContainer')
   */
  if (!taskDefinition.containerDefinitions)
    throw new Error('Could not retrieve container definitions');
  const containerIdx = taskDefinition.containerDefinitions.findIndex((cd) => {
    return cd.name === containerDefName;
  });
  const newImageId = ecrArnToImageId(imageArn);

  // use a copy of the task definition object for the update
  const newTaskDef = JSON.parse(JSON.stringify(taskDefinition));

  // replace the image id with our new one
  newTaskDef.containerDefinitions[containerIdx].image = newImageId;

  // add the tags from our tag set request
  newTaskDef.tags = tagResp.tags;

  /**
   * delete invalid params that are returned by `returnTaskDefinition` but
   * not allowed by `registerTaskDefinition`
   */
  const registerTaskDefinitionParams = [
    'containerDefinitions',
    'cpu',
    'executionRoleArn',
    'family',
    'memory',
    'networkMode',
    'placementConstraints',
    'requiresCompatibilities',
    'taskRoleArn',
    'volumes',
  ];
  Object.keys(newTaskDef).forEach((k) => {
    if (!registerTaskDefinitionParams.includes(k)) {
      delete newTaskDef[k];
    }
  });

  const registerResp = await ecs.registerTaskDefinition(newTaskDef).promise();
  console.log('done');

  return registerResp.taskDefinition?.taskDefinitionArn;
};

export default updateTaskDefAppImage;
