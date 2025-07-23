import {
  DescribeParametersCommand,
  type DescribeParametersCommandInput,
  SSMClient,
} from '@aws-sdk/client-ssm';

import getPaginatedResponseV2 from './getPaginatedResponseV2.js';

/**
 * Return all the unique app parameter namespaces, i.e., all the
 * distinct values that come after `/[prefix]` in the hierarchy.
 *
 * The SSM API doesn't have a great way to search/filter for parameter
 * store entries
 *
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} prefix - name prefix used by the app CloudFormation stacks
 * @param {profile} [profile='default'] AWS profile
 * @returns {string[]} list of app namespaces
 */
const getAppList = async (
  prefix: string,
  profile = 'default',
): Promise<(string | undefined)[]> => {
  const client = new SSMClient({ profile });
  const searchParams: DescribeParametersCommandInput = {
    MaxResults: 50, // lord i hope we never have this many apps
    ParameterFilters: [
      {
        Key: 'Name',
        Option: 'Contains',
        // making an assumption that all configurations will include this
        Values: ['/infraStackName'],
      },
    ],
  };

  const paramEntries = await getPaginatedResponseV2(async (_input) => {
    const command = new DescribeParametersCommand(_input);
    const res = await client.send(command);
    return {
      NextToken: res.NextToken,
      items: res.Parameters,
    };
  }, searchParams);
  return paramEntries.flatMap((param) => {
    if (!param.Name || !param.Name.startsWith(prefix)) return [];
    return param.Name.split('/')[2];
  });
};

export default getAppList;
