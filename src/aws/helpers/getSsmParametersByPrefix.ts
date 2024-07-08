// Import aws-sdk
import AWS, { SSM } from 'aws-sdk';

// Import helpers
import getPaginatedResponse from './getPaginatedResponse.js';

/**
 * Fetch a set of parameter store entries based on a name prefix,
 *  e.g. `/caccl-deploy/foo-app`
 * @author Jay Luker
 * @param {string} prefix
 * @returns {object[]}
 */
const getSsmParametersByPrefix = async (
  prefix: string,
): Promise<SSM.Types.ParameterList> => {
  const ssm = new AWS.SSM();
  await ssm.getParametersByPath().promise();
  return getPaginatedResponse(
    ssm.getParametersByPath.bind(ssm),
    {
      Path: prefix,
      Recursive: true,
    },
    'Parameters',
  );
};

export default getSsmParametersByPrefix;
