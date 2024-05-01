import CacclDeployCommander from './classes/CacclDeployCommander';

import imagesOperation from './operations/imagesOperation';

const addImagesCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('images')
    .description('list the most recent available ECR images for an app')
    .requiredOption(
      '-r --repo <string>',
      'the name of the ECR repo; use `caccl-deploy app repos` for available repos',
    )
    .option(
      '-A --all',
      'show all images; default is to show only semver-tagged releases',
    )
    .action(imagesOperation);
};

export default addImagesCommand;
