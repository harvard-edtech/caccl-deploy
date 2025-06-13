import {
  NODE_REGION_CONFIG_FILE_OPTIONS,
  NODE_REGION_CONFIG_OPTIONS,
} from '@smithy/config-resolver';
import { loadConfig } from '@smithy/node-config-provider';
import process from 'node:process';

/**
 * Returns the configured region.
 * The region can be set in a couple of ways:
 *   - the usual env vars, AWS_REGION, etc
 *   - a region configured in the user's AWS profile/credentials
 * @author Jay Luker
 * @returns {string} AWS region
 */
const getCurrentRegion = async (): Promise<string> => {
  const currentRegion = await loadConfig(
    NODE_REGION_CONFIG_OPTIONS,
    NODE_REGION_CONFIG_FILE_OPTIONS,
  )();
  if (!currentRegion) {
    if (process.env.NODE_ENV === 'test') {
      return 'us-east-1';
    }

    // TODO: fix this error
    throw new Error("Please configure you're AWS region.");
  }

  return currentRegion;
};

export default getCurrentRegion;
