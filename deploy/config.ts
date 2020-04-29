import * as path from 'path';

module.exports = () => {

  /**
   * this should be set by `index.js` when the calling app execs a deploy command.
   * it identifies the root directory of of the calling app and is needed
   * to locate the app's deployConfig.js and also potentially the docker image buildPath
   */

  const appDir = process.env.APP_DIR;

  // allow alternative deploy config path
  let deployConfigPath = process.env.CACCL_DEPLOY_CONFIG

  if (deployConfigPath === undefined) {
    if (appDir === undefined) {
      console.log('No CACCL_DEPLOY_CONFIG value and APP_DIR is not set');
      process.exit();
    }
    deployConfigPath = path.join(appDir, 'config/deployConfig.js');
  }

  try {
    return require(deployConfigPath);
  } catch (err) {
    console.log(`Failed loading deploy config from ${deployConfigPath}: ${err.message}`);
    process.exit(1);
  }
};
