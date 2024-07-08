// Import aws
import exitWithError from './exitWithError.js';
import { initProfile } from '../aws/index.js';

// Import shared errors
import AwsProfileNotFound from '../shared/errors/AwsProfileNotFound.js';

// Import helpers

/**
 * callback function for the `--profile` option
 * @author Jay Luker
 * @param {string} profile
 */
const initAwsProfile = async (profile: string): Promise<string> => {
  try {
    initProfile(profile);
    return profile;
  } catch (err) {
    if (err instanceof AwsProfileNotFound) {
      exitWithError(err.message);
    } else {
      throw err;
    }
  }
  return profile;
};

export default initAwsProfile;
