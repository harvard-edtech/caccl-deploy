// Import aws-sdk
import AWS from 'aws-sdk';

/**
 * Returns the configured region.
 * The region can be set in a couple of ways:
 *   - the usual env vars, AWS_REGION, etc
 *   - a region configured in the user's AWS profile/credentials
 * @author Jay Luker
 * @returns {string}
 */
const getCurrentRegion = () => {
  return AWS.config.region;
};

export default getCurrentRegion;
