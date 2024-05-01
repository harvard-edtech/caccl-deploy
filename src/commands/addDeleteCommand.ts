import CacclDeployCommander from './classes/CacclDeployCommander';

import deleteOperation from './operations/deleteOperation';

const addDeleteCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('delete')
    .description('delete an app configuration')
    .appOption()
    .action(deleteOperation);
};

export default addDeleteCommand;
