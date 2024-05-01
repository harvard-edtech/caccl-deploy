import CacclDeployCommander from './classes/CacclDeployCommander';

import showOperation from './operations/showOperation';

const addShowCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('show')
    .description("display an app's current configuration")
    .appOption()
    .option('-f --flat', 'display the flattened, key: value form of the config')
    .option('-s --sha', 'output a sha1 hash of the current configuration')
    .option(
      '--keep-secret-arns',
      'show app environment secret value ARNs instead of dereferencing',
    )
    .action(showOperation);
};

export default addShowCommand;
