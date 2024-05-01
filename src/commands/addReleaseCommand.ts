import CacclDeployCommander from './classes/CacclDeployCommander';

import releaseOperation from './operations/releaseOperation';

const addReleaseCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('release')
    .description('release a new version of an app')
    .appOption()
    .requiredOption(
      '-i --image-tag <string>',
      'the docker image version tag to release',
    )
    .option(
      '--no-deploy',
      "Update the Fargate Task Definition but don't restart the service",
    )
    .action(releaseOperation);
};

export default addReleaseCommand;
