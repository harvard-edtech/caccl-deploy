// Import aws-sdk
import AWS, { ECS } from 'aws-sdk';

import getCurrentRegion from './getCurrentRegion.js';

// Import shared helpers
import sleep from '../../shared/helpers/sleep.js';

// Import logger
import logger from '../../logger.js';

export type RestartOpts = {
  cluster: string;
  service: string;
  newTaskDefArn?: string;
  wait: boolean;
};

/**
 * Restart an app's ECS service
 * @author Jay Luker
 * @param {string} cluster
 * @param {string} service
 * @param {boolean} wait
 */
const restartEcsService = async (restartOpts: RestartOpts) => {
  const { cluster, service, newTaskDefArn, wait } = restartOpts;
  const ecs = new AWS.ECS();
  logger.log(
    [
      'Console link for monitoring: ',
      `https://console.aws.amazon.com/ecs/home?region=${getCurrentRegion()}`,
      `#/clusters/${cluster}/`,
      `services/${service}/tasks`,
    ].join(''),
  );

  const updateServiceParams: ECS.UpdateServiceRequest = {
    cluster,
    service,
    forceNewDeployment: true,
  };

  if (newTaskDefArn) {
    updateServiceParams.taskDefinition = newTaskDefArn;
  }

  // execute the service deployment
  await ecs.updateService(updateServiceParams).promise();

  // return immediately if
  if (!wait) {
    return;
  }
  let allDone = false;
  await ecs
    .waitFor('servicesStable', {
      cluster,
      services: [service],
    })
    .promise()
    .then(() => {
      allDone = true;
    });

  let counter = 0;
  while (!allDone) {
    logger.log('Waiting for deployment to stablize...');
    counter += 1;
    await sleep(2 ** counter * 1000);
  }
  logger.log('all done!');
};

export default restartEcsService;
