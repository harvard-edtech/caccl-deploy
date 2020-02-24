import * as path from 'path';

module.exports = () => {
  const appBaseDir = process.env.APP_BASE_DIR;
  if (appBaseDir === undefined) {
    console.log('$APP_BASE_DIR not set');
    process.exit();
  }
  try {
    const deployConfigFile = path.join(appBaseDir, 'config/deployConfig.js');
    const deployConfig = require(deployConfigFile);
    return deployConfig;
  } catch (err) {
    console.log(`Failed loading deployConfig.js: ${err.message}`);
    process.exit(1);
  }
};
