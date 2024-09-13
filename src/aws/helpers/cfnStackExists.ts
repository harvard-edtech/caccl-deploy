// Import shared errors
import CfnStackNotFound from '../../shared/errors/CfnStackNotFound.js';
import getCfnStackExports from './getCfnStackExports.js';

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
  } catch (error) {
    if (!(error instanceof CfnStackNotFound)) {
      throw error;
    }
  }

  return false;
};

export default cfnStackExists;
