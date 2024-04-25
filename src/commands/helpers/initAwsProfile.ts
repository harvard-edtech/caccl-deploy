// Import aws
import exitWithError from './exitWithError';
import { initProfile } from '../../aws';

// Import shared errors
import AwsProfileNotFound from '../../shared/errors/AwsProfileNotFound';

// Import helpers

/**
 * callback function for the `--profile` option
 * @author Jay Luker
 * @param {string} profile
 */
const initAwsProfile = (profile: string): string => {
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
