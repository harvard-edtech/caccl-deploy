import CacclDeployCommander from './classes/CacclDeployCommander';

import stackOperation from './operations/stackOperation';

const addStackCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('stack')
    .description("diff, deploy, or delete the app's AWS resources")
    .appOption()
    .action(stackOperation);
};

export default addStackCommand;
