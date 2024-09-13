// Import aws-sdk
import AWS, { ECS } from 'aws-sdk';

import logger from '../../logger.js';
// Import shared helpers
import getCurrentRegion from './getCurrentRegion.js';
// Import logger

export type RestartOpts = {
  cluster: string;
  newTaskDefArn?: string;
  service: string;
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
  const { cluster, newTaskDefArn, service, wait } = restartOpts;
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
    forceNewDeployment: true,
    service,
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

  logger.log('Waiting for deployment to stabilize...');
  await ecs
    .waitFor('servicesStable', {
      cluster,
      services: [service],
    })
    .promise();

  logger.log('all done!');
};

export default restartEcsService;
