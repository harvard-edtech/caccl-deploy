// Import aws-sdk
import AWS from 'aws-sdk';

// Import errors
import AwsAccountNotFound from '../../shared/errors/AwsAccountNotFound.js';

/**
 * Get the account ID corresponding to the current AWS user.
 * @author Jay Luker
 * @returns {string} the AWS account id of the current user.
 */
const getAccountId = async (): Promise<string> => {
  const sts = new AWS.STS();
  const identity = await sts.getCallerIdentity({}).promise();
  const accountId = identity.Account;
  if (!accountId) {
    throw new AwsAccountNotFound('Could not retrieve users account ID.');
  }

  return accountId;
};

export default getAccountId;
