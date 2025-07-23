import chalk from 'chalk';

import getCfnStackExports from '../aws/helpers/getCfnStackExports.js';
import CACCL_DEPLOY_VERSION from '../constants/CACCL_DEPLOY_VERSION.js';
import warnAboutVersionDiff from '../shared/helpers/warnAboutVersionDiff.js';
import confirm from './confirm.js';

/**
 * Will add another confirm prompt that warns if the deployed stack's
 * version is more than a patch version different from the cli tool.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} cfnStackName name of the CloudFormation stack whose version we are checking.
 * @param {string} [profile='default'] AWS profile for the CloudFormation stack.
 * @returns {Promise<boolean>} Whether the version of the stack is different from the user's local config.
 */
const stackVersionDiffCheck = async (
  cfnStackName: string,
  profile = 'default',
): Promise<boolean> => {
  const cfnExports = await getCfnStackExports(cfnStackName, profile);
  const stackVersion = cfnExports.cacclDeployVersion ?? '';
  const cliVersion = CACCL_DEPLOY_VERSION;
  if (
    cliVersion === stackVersion ||
    !warnAboutVersionDiff(stackVersion, cliVersion)
  ) {
    return true;
  }

  const confirmMsg = `Stack deployed with ${chalk.redBright(
    stackVersion,
  )}; you are using ${chalk.redBright(cliVersion)}. Proceed?`;
  return confirm(confirmMsg, false);
};

export default stackVersionDiffCheck;
