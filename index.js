/* eslint-disable no-console */

const { execSync } = require('child_process');
const path = require('path');
const minimist = require('minimist');
const print = require('./helpers/print');
const aws = require('./helpers/aws');
const ConfigManager = require('./helpers/configManager');

// Prep command executor
const exec = (command, options = {}) => {
  options.stdio = 'inherit';
  console.log(command);
  return execSync(command, options);
};

module.exports = async () => {

  const args = minimist(process.argv.slice(2), {
    // allow use of config in an alternate location
    string: [ 'config', 'profile' ],
    alias: { c: 'config', p: 'profile' },
  });

  let configManager;
  let cdkExecPath;
  let cdkProfileOption = '';

  // set the AWS api module to use a specified profile
  if (args.profile !== undefined) {
    aws.initProfile(args.profile);
    cdkProfileOption = `--profile ${args.profile}`;
  }

  // First see if we were provided an explicit config path.
  // This is most likely when using as a stand-alone tool
  if (args.config !== undefined) {
    configManager = new ConfigManager(args.config);
    if (!configManager.exists()) {
      throw new Error(`No config file at '${args.config}'`);
    }
    cdkExecPath = process.env.PWD;
  } else {
    // Otherwise assume we're running as an installed package
    // in the context of an app to deploy
    configPath = path.join(process.env.PWD, 'config/deployConfig.js')
    configManager = new ConfigManager(configPath);

    // confirm config/deployConfig.js exists or create it
    if (!configManager.exists()) {
      console.log(`no deploy config found at ${configPath}`);
      console.log("We can generate one now, but you'll need several bits of information, ");
      console.log('including AWS and LTI client and consumer credentials, as well as ');
      console.log('the ARN identifier of an AWS Certificate Manager SSL certificate.');
      print.enterToContinue();
      await configManager.generate();
    }
    // exec cdk in the caccl-deploy directory; $PWD is safe so long as we're called via `npm run ...`
    cdkExecPath = path.join(process.env.PWD, 'node_modules/caccl-deploy');

  }

  // validate the deploy config
  if (!configManager.validate()) {
    throw new Error('deployConfig.js is invalid!');
  }

  // by default run `cdk deploy` but also allow other cdk commands for advanced users
  const cdkCommand = args._.length
    ? `cdk ${args._.join(' ')} ${cdkProfileOption}`
    : `cdk list ${cdkProfileOption}`; // deploy'

  // for adding some environment variables
  const envCopy = Object.assign({}, process.env);

  // tell the cdk app where our config is
  envCopy.CACCL_DEPLOY_CONFIG = configManager.configPath;

  // tell the cdk exec environment where our calling app lives
  envCopy.APP_DIR = process.env.PWD;

  // set a default for the aws account id. This value comes from an AWS STS API call to get the
  // caller identity. It will not override an `awsAccountId` setting in the `deployConfig.js`
  envCopy.AWS_ACCOUNT_ID = await aws.getAccountId();

  if (envCopy.AWS_REGION === undefined) {
    envCopy.AWS_REGION = 'us-east-1';
  }

  console.log(`About to execute ${cdkCommand}`);
  print.enterToContinue();

  // TODO: do we need to try/catch here, or does `run.js` deal with that?
  exec(cdkCommand, { env: envCopy, cwd: cdkExecPath });
};
