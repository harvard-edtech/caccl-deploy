import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

import AwsAccountNotFound from '../../shared/errors/AwsAccountNotFound.js';

/**
 * Get the account ID corresponding to the current AWS user.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} [profile='default'] AWS profile.
 * @returns {string} the AWS account id of the current user.
 */
const getAccountId = async (profile = 'default'): Promise<string> => {
  const client = new STSClient({ profile });
  const command = new GetCallerIdentityCommand({});
  const identity = await client.send(command);
  const accountId = identity.Account;
  if (!accountId) {
    throw new AwsAccountNotFound('Could not retrieve users account ID.');
  }

  return accountId;
};

export default getAccountId;
