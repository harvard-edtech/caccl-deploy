// Import aws-sdk
import AWS, { ECS } from 'aws-sdk';

/**
 * Fetches the data for an ECS service
 * @param {string} cluster
 * @param {string} service
 * @returns {ECS.Service}
 */
const getService = async (
  cluster: string,
  service: string,
): Promise<ECS.Service> => {
  const ecs = new AWS.ECS();
  const resp = await ecs
    .describeServices({
      cluster,
      services: [service],
    })
    .promise();

  if (!resp.services) {
    throw new Error(`service ${service} not found`);
  }

  return resp.services[0];
};

export default getService;
