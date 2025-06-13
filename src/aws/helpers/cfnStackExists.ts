import CfnStackNotFound from '../../shared/errors/CfnStackNotFound.js';
import getCfnStackExports from './getCfnStackExports.js';

/**
 * Confirm that a CloudFormation stack exists
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} stackName name of the stack to search for.
 * @param {string} [profile='default'] AWS profile to use.
 * @return {Promise<boolean>} whether the CloudFormation stack exists or not.
 */
const cfnStackExists = async (
  stackName: string,
  profile = 'default',
): Promise<boolean> => {
  try {
    await getCfnStackExports(stackName, profile);
    return true;
  } catch (error) {
    if (!(error instanceof CfnStackNotFound)) {
      throw error;
    }
  }

  return false;
};

export default cfnStackExists;
