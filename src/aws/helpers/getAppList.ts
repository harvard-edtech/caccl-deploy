// Import aws-sdk
import AWS from 'aws-sdk';

// Import helpers
import getPaginatedResponse from './getPaginatedResponse';

/**
 * Return all the unique app parameter namespaces, i.e., all the
 * distinct values that come after `/[prefix]` in the hierarchy.
 *
 * The SSM API doesn't have a great way to search/filter for parameter
 * store entries
 *
 * @author Jay Luker
 * @param {string} prefix - name prefix used by the app CloudFormation stacks
 * @returns {string[]}
 */
const getAppList = async (prefix: string): Promise<string[]> => {
  const ssm = new AWS.SSM();
  const searchParams = {
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

  const paramEntries = await getPaginatedResponse(
    ssm.describeParameters.bind(ssm),
    searchParams,
    'Parameters',
  );
  return paramEntries.flatMap((param) => {
    if (!param.Name || param.Name.startsWith(prefix)) return [];
    return param.Name.split('/')[2];
  });
};

export default getAppList;
