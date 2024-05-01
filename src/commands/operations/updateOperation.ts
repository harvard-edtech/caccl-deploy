import { confirmProductionOp } from '../../configPrompts';

import validSSMParamName from '../../shared/helpers/validSSMParamName';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const updateOperation = async (cmd: any) => {
  const deployConfig = await cmd.getDeployConfig(true);

  if (!(await confirmProductionOp(cmd.yes))) {
    exitWithSuccess();
  }

  if (cmd.args.length > 2) {
    exitWithError('Too many arguments!');
  }

  try {
    if (cmd.delete) {
      const [param] = cmd.args;
      await deployConfig.delete(cmd.getAppPrefix(), param);
    } else {
      const [param, value] = cmd.args;
      if (!validSSMParamName(param)) {
        throw new Error(`Invalid param name: '${param}'`);
      }
      await deployConfig.update(cmd.getAppPrefix(), param, value);
    }
  } catch (err) {
    exitWithError(`Something went wrong: ${err.message}`);
  }
};

export default updateOperation;
