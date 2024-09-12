// Import NodeJS libraries
import process from 'node:process';

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
    if (process.env.NODE_ENV === 'test') {
      return 'us-east-1';
    }
    // TODO: fix this error
    throw new Error('Please configure you\'re AWS region.');
  }
  return region;
};

export default getCurrentRegion;
