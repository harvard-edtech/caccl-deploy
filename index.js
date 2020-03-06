const { execSync } = require('child_process');
const path = require('path');

/* eslint-disable no-console */

// Prep command executor
const exec = (command, options = {}) => {
  options.stdio = 'inherit';
  console.log(command);
  return execSync(command, options);
};

// Import helpers
const print = require('./helpers/print');
const getAppNameFromPackage = require('./helpers/getAppNameFromPackage');
const manageDeployConfig = require('./helpers/manageDeployConfig');

module.exports = async () => {

  // take the app's name from package.json
  const appName = getAppNameFromPackage();
  console.log(`Using app name: ${appName}`);
  print.enterToContinue();

  // confirm config/deployConfig.js exists or create it
  if (!manageDeployConfig.exists()) {
    console.log('no deploy config; let\'s generate it!');
    await manageDeployConfig.generate();
  }

  // validate the deploy config
  if (!manageDeployConfig.validate()) {
    console.log('deployConfig.js is invalid!');
  }

  const argv = process.argv.slice(2);

  // by default we run `cdk deploy` but also allow
  // other cdk commands for advanced users
  const cdkCommand = (argv.length)
    ? `cdk ${argv.join(' ')}`
    : 'cdk list'; // deploy'

  // cdk commands must be exec'd in the caccl-deploy package directory
  const cdkExecPath = path.resolve('./node_modules/caccl-deploy');

  /**
   * prefix commands with an env var so that caccl-deploy process
   * can find the app's base directory, and from there the deployConfig.js
   * The process might also need to run a docker build command
   */
  const appBaseEnvVar = `export APP_BASE_DIR=${process.cwd()}`;

  console.log(`About to execute ${cdkCommand}`);
  print.enterToContinue();

  // TODO: do we need to try/catch here, or does `run.js` deal with that?
  exec(`${appBaseEnvVar}; ${cdkCommand} `, { cwd: cdkExecPath });
}
