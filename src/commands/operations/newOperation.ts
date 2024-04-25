// Import chalk
import chalk from 'chalk';

// Import figlet
import figlet from 'figlet';

// Import aws
import {
  cfnStackExists,
  getAppList,
  // FIXME:
  // setAssumedRoleArn,
} from '../../aws';

import {
  confirm,
  confirmProductionOp,
  promptAppName,
} from '../../configPrompts';

import DeployConfig from '../../deployConfig';

import NoPromptChoices from '../../shared/errors/NoPromptChoices';
import UserCancel from '../../shared/errors/UserCancel';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const newOperation = async (cmd: CacclDeployCommander) => {
  if (cmd.ecrAccessRoleArn !== undefined) {
    // setAssumedRoleArn(cmd.ecrAccessRoleArn);
  }
  const existingApps = await getAppList(cmd.ssmRootPrefix);

  let appName;
  try {
    appName = cmd.app || (await promptAppName());
  } catch (err) {
    if (err instanceof UserCancel) {
      exitWithSuccess();
    }
    throw err;
  }

  const appPrefix = cmd.getAppPrefix(appName);

  if (existingApps.includes(appName)) {
    const cfnStackName = cmd.getCfnStackName(appName);
    if (await cfnStackExists(cfnStackName)) {
      exitWithError('A deployed app with that name already exists');
    } else {
      console.log(`Configuration for ${cmd.app} already exists`);
    }

    if (cmd.yes || (await confirm('Overwrite?'))) {
      if (!(await confirmProductionOp(cmd.yes))) {
        exitWithSuccess();
      }
      await DeployConfig.wipeExisting(appPrefix);
    } else {
      exitWithSuccess();
    }
  }

  /**
   * Allow importing some or all of a deploy config.
   * What gets imported will be passed to the `generate`
   * operation to complete any missing settings
   */
  let importedConfig;
  if (cmd.import !== undefined) {
    importedConfig = /^http(s):\//.test(cmd.import)
      ? await DeployConfig.fromUrl(cmd.import)
      : DeployConfig.fromFile(cmd.import);
  }

  let deployConfig;
  try {
    deployConfig = await DeployConfig.generate(importedConfig);
  } catch (err) {
    if (err instanceof UserCancel) {
      exitWithSuccess();
    } else if (err instanceof NoPromptChoices) {
      exitWithError(
        [
          'Something went wrong trying to generate your config: ',
          err.message,
        ].join('\n'),
      );
    }
    throw err;
  }

  await DeployConfig.syncToSsm(deployConfig, appPrefix);
  exitWithSuccess(
    [
      chalk.yellowBright(figlet.textSync(`${appName}!`)),
      '',
      'Your new app deployment configuration is created!',
      'Next steps:',
      `  * modify or add settings with 'caccl-deploy update -a ${appName} [...]'`,
      `  * deploy the app stack with 'caccl-deploy stack -a ${appName} deploy'`,
      '',
    ].join('\n'),
  );
};

export default newOperation;
