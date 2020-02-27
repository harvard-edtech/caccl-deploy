const promptSync = require('prompt-sync')();
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
const aws = require('./helpers/aws');
const deployConfig = require('./helpers/deployConfig');

const prompt = (title, notRequired) => {
  const val = promptSync(title);
  if (val === null || (!notRequired && !val)) {
    process.exit(0);
  }
  return val;
};
print.savePrompt(prompt);

module.exports = () => {
  // take the app's name from package.json
  const appName = getAppNameFromPackage();
  console.log(appName);

  // confirm ~/.aws/config and ~/.aws/credentials exist

  // confirm config/deployConfig.js exists or create it
  if (!deployConfig.exists()) {
    console.log('no deploy config!');
  }

  // validate the deploy config
  if (!deployConfig.validate()) {
    console.log('deployConfig.js is invalid!');
  }

  const argv = process.argv.slice(2);

  // allow other cdk commands for advanced users
  const cdkCommand = (argv.length)
    ? `cdk ${argv.join(' ')}`
    : 'cdk list'; // deploy'

  // cdk commands must be exec'd in the caccl-deploy package directory
  const cdkExecPath = path.resolve('./node_modules/caccl-deploy');

  /**
   * prefix commands with an env var so that caccl-deploy can find the
   * app's deploy config and potentially run a docker build command
   */
  const appBaseEnvVar = `export APP_BASE_DIR=${process.cwd()}`;

  try {
    exec(`${appBaseEnvVar}; ${cdkCommand} `, { cwd: cdkExecPath });
  } catch (err) {

  }
}
