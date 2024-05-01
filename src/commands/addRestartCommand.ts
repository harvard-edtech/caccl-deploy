import CacclDeployCommander from './classes/CacclDeployCommander';

import restartOperation from './operations/restartOperation';

const addRestartCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('restart')
    .description('no changes; just force a restart')
    .appOption()
    .action(restartOperation);
};

export default addRestartCommand;
