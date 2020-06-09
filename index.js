/* eslint-disable no-console */

const { execSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

// Prep command executor
const exec = (command, options = {}) => {
  options.stdio = 'inherit';
  console.log(command);
  return execSync(command, options);
};

// Import helpers
const print = require('./helpers/print');
const ConfigManager = require('./helpers/configManager');

module.exports = async () => {
  const configManager = new ConfigManager();

  // confirm config/deployConfig.js exists or create it
  if (!configManager.exists()) {
    console.log(`no deploy config found at ${configManager.deployConfigPath}`);
    console.log("We can generate one now, but you'll need several bits of information, ");
    console.log('including AWS and LTI client and consumer credentials, as well as ');
    console.log('the ARN identifier of an AWS Certificate Manager SSL certificate.');
    print.enterToContinue();
    await configManager.generate();
  }

  // validate the deploy config
  if (!configManager.validate()) {
    console.log('deployConfig.js is invalid!');
  }

  // by default we run `cdk deploy` but also allow
  // other cdk commands for advanced users
  const cdkCommand = argv._.length ? `cdk ${argv._.join(' ')}` : 'cdk list'; // deploy'

  // cdk commands must be exec'd in the caccl-deploy package directory
  // use of $PWD should be a safe assumption so long as we're being called via `npm run ...`
  const cdkExecPath = path.join(process.env.PWD, 'node_modules/caccl-deploy');

  console.log(`About to execute ${cdkCommand}`);
  print.enterToContinue();

  // tell the cdk exec environment where our calling app lives
  const envCopy = Object.assign({}, process.env);
  envCopy.APP_DIR = process.env.PWD;

  // TODO: do we need to try/catch here, or does `run.js` deal with that?
  exec(cdkCommand, { env: envCopy, cwd: cdkExecPath });
};
