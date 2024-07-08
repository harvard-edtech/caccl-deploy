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
const getCurrentRegion = (): string => {
  const { region } = AWS.config;
  if (!region) {
    // TODO: better error type
    throw new Error('Could not get current AWS region.');
  }
  return region;
};

export default getCurrentRegion;
