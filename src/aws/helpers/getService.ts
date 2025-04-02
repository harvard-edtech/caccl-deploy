import {
  DescribeServicesCommand,
  ECSClient,
  Service,
} from '@aws-sdk/client-ecs';

/**
 * Fetches the data for an ECS service
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} cluster cluster to fetch data from.
 * @param {string} service service to fetch data from.
 * @param {string} [profile='default'] AWS profile.s
 * @returns {Service} ECS service info.
 */
const getService = async (
  cluster: string,
  service: string,
  profile = 'default',
): Promise<Service> => {
  const client = new ECSClient({ profile });
  const command = new DescribeServicesCommand({
    cluster,
    services: [service],
  });
  const resp = await client.send(command);

  if (!resp.services) {
    throw new Error(`service ${service} not found`);
  }

  return resp.services[0];
};

export default getService;
