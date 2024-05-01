import { cfnStackExists } from '../../aws';

import { confirm, confirmProductionOp } from '../../configPrompts';

import DeployConfig from '../../deployConfig';

import AppNotFound from '../../shared/errors/AppNotFound';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const deleteOperation = async (cmd: any) => {
  const cfnStackName = cmd.getCfnStackName();
  if (await cfnStackExists(cfnStackName)) {
    exitWithError(
      [
        `You must first run "caccl-deploy stack -a ${cmd.app} destroy" to delete`,
        `the deployed ${cfnStackName} CloudFormation stack before deleting it's config.`,
      ].join('\n'),
    );
  }

  try {
    console.log(`This will delete all deployment configuation for ${cmd.app}`);

    if (!(cmd.yes || (await confirm('Are you sure?')))) {
      exitWithSuccess();
    }
    // extra confirm if this is a production deployment
    if (!(await confirmProductionOp(cmd.yes))) {
      exitWithSuccess();
    }

    await DeployConfig.wipeExisting(cmd.getAppPrefix(), false);

    exitWithSuccess(`${cmd.app} configuration deleted`);
  } catch (err) {
    if (err instanceof AppNotFound) {
      exitWithError(`${cmd.app} app configuration not found!`);
    }
  }
};

export default deleteOperation;
