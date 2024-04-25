import CacclDeployCommander from './classes/CacclDeployCommander';

// Import operation
import appsOperation from './operations/appsOperation';

const addAppsCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  // Apps command
  return cli
    .command('apps')
    .option(
      '--full-status',
      'show the full status of each app including CFN stack and config state',
    )
    .description('list available app configurations')
    .action(appsOperation);
};

export default addAppsCommand;
