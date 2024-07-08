// Import shared errors
import getCfnStackExports from './getCfnStackExports.js';
import CfnStackNotFound from '../../shared/errors/CfnStackNotFound.js';

// Import helpers

/**
 * Confirm that a CloudFormation stack exists
 * @param {string} stackName
 * @return {boolean}
 */
const cfnStackExists = async (stackName: string): Promise<boolean> => {
  try {
    await getCfnStackExports(stackName);
    return true;
  } catch (err) {
    if (!(err instanceof CfnStackNotFound)) {
      throw err;
    }
  }
  return false;
};

export default cfnStackExists;
