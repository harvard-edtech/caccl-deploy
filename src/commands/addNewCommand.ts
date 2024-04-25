import CacclDeployCommander from './classes/CacclDeployCommander';
import newOperation from './operations/newOperation';

const addNewCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('new')
    .description('create a new app deploy config via import and/or prompts')
    .appOption(true)
    .option(
      '-i --import <string>',
      'import new deploy config from a json file or URL',
    )
    .description('create a new app configuration')
    .action(newOperation);
};

export default addNewCommand;
