import CacclDeployCommander from './classes/CacclDeployCommander';

import updateOperation from './operations/updateOperation';

const addUpdateCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('update')
    .description('update (or delete) a single deploy config setting')
    .appOption()
    .option(
      '-D --delete',
      'delete the named parameter instead of creating/updating',
    )
    .action(updateOperation);
};

export default addUpdateCommand;
