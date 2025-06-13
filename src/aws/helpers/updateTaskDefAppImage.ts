import {
  ECSClient,
  ListTagsForResourceCommand,
  RegisterTaskDefinitionCommand,
} from '@aws-sdk/client-ecs';

import logger from '../../logger.js';
import ecrArnToImageId from './ecrArnToImageId.js';
import getTaskDefinition from './getTaskDefinition.js';

type UpdateTaskDefAppImageOpts = {
  containerDefName: string;
  imageArn: string;
  profile?: string;
  taskDefName: string;
};

/**
 * Updates a Fargate task definition, replacing the app container's
 *   ECR image URI value
 * @author Jay Luker, Benedikt Arnarsson
 * @param {UpdateTaskDefAppImageOpts} opts update task definition application image options.
 * @param {string} opts.containerDefName container whose image ID we are changing.
 * @param {string} opts.imageArn new image ARN.
 * @param {string} [opts.profile='default'] AWS profile.
 * @param {string} opts.taskDefName name of the tas definition whose ECR image URI value we are changing.
 * @returns {string} - the full ARN (incl family:revision) of the newly
 *   registered task definition
 */
const updateTaskDefAppImage = async (
  opts: UpdateTaskDefAppImageOpts,
): Promise<string | undefined> => {
  const { containerDefName, imageArn, profile = 'default', taskDefName } = opts;

  const client = new ECSClient({ profile });
  const taskDefinition = await getTaskDefinition(taskDefName, profile);
  if (!taskDefinition.taskDefinitionArn)
    throw new Error('Could not get task definition ARN');

  // get existing tag set to include with the new task def
  const listTagsCommand = new ListTagsForResourceCommand({
    resourceArn: taskDefinition.taskDefinitionArn,
  });
  const tagResp = await client.send(listTagsCommand);

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
  const registerTaskDefinitionParams = new Set([
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
  ]);
  for (const k of Object.keys(newTaskDef)) {
    if (!registerTaskDefinitionParams.has(k)) {
      delete newTaskDef[k];
    }
  }

  const registerTaskDefCommand = new RegisterTaskDefinitionCommand(newTaskDef);
  const registerResp = await client.send(registerTaskDefCommand);
  logger.log('done');

  return registerResp.taskDefinition?.taskDefinitionArn;
};

export default updateTaskDefAppImage;
