import CacclDeployCommander from './classes/CacclDeployCommander';

import reposOperation from './operations/reposOperation';

const addReposCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('repos')
    .description('list the available ECR repositories')
    .action(reposOperation);
};

export default addReposCommand;
