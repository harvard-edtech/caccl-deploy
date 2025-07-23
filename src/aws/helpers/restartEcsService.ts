import {
  ECSClient,
  UpdateServiceCommand,
  type UpdateServiceCommandInput,
  waitUntilServicesStable,
} from '@aws-sdk/client-ecs';

import logger from '../../logger.js';
import getCurrentRegion from './getCurrentRegion.js';

export type RestartOpts = {
  cluster: string;
  newTaskDefArn?: string;
  profile?: string;
  service: string;
  wait: boolean;
};

/**
 * Restart an app's ECS service
 * @author Jay Luker, Benedikt Arnarsson
 * @param {RestartOpts} restartOpts restart options
 * @param {string} restartOpts.cluster cluster to restart
 * @param {string} restartOpts.newTaskDefArn new task definition to restart to
 * @param {string} [restartOpts.profile='default'] AWS profile
 * @param {string} restartOpts.service service to restart
 * @param {boolean} restartOpts.wait time to wait for the restart to finish
 * @return {Promise<void>} promise to await
 */
const restartEcsService = async (restartOpts: RestartOpts) => {
  const {
    cluster,
    newTaskDefArn,
    profile = 'default',
    service,
    wait,
  } = restartOpts;
  const client = new ECSClient({ profile });
  const region = await getCurrentRegion();
  logger.log(
    [
      'Console link for monitoring: ',
      `https://console.aws.amazon.com/ecs/home?region=${region}`,
      `#/clusters/${cluster}/`,
      `services/${service}/tasks`,
    ].join(''),
  );

  const updateServiceParams: UpdateServiceCommandInput = {
    cluster,
    forceNewDeployment: true,
    service,
  };

  if (newTaskDefArn) {
    updateServiceParams.taskDefinition = newTaskDefArn;
  }

  // execute the service deployment
  const updateServiceCommand = new UpdateServiceCommand(updateServiceParams);
  await client.send(updateServiceCommand);

  // return immediately if
  if (!wait) {
    return;
  }

  logger.log('Waiting for deployment to stabilize...');
  await waitUntilServicesStable(
    {
      client,
      // TODO: adjust these numbers?
      // maxDelay: 1,
      maxWaitTime: 600,
      // minDelay: 1,
    },
    {
      cluster,
      services: [service],
    },
  );

  logger.log('all done!');
};

export default restartEcsService;
