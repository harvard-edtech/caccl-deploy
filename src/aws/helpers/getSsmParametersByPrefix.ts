import {
  GetParametersByPathCommand,
  GetParametersByPathCommandInput,
  Parameter,
  SSMClient,
} from '@aws-sdk/client-ssm';

import getPaginatedResponseV2 from './getPaginatedResponseV2.js';

/**
 * Fetch a set of parameter store entries based on a name prefix,
 *  e.g. `/caccl-deploy/foo-app`
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} prefix application SSM prefix.
 * @param {string} [profile='default'] AWS profile.
 * @returns {Parameter[]} SSM parameters associated with the app configuration.
 */
const getSsmParametersByPrefix = async (
  prefix: string,
  profile = 'default',
): Promise<Parameter[]> => {
  const client = new SSMClient({ profile });
  return getPaginatedResponseV2(
    async (_input: GetParametersByPathCommandInput) => {
      const command = new GetParametersByPathCommand(_input);
      const res = await client.send(command);
      return {
        NextToken: res.NextToken,
        items: res.Parameters,
      };
    },
    {
      Path: prefix,
      Recursive: true,
    },
  );
};

export default getSsmParametersByPrefix;
