/* eslint-disable no-console */

const path = require('path');
const minimist = require('minimist');
const print = require('./helpers/print');
const aws = require('./helpers/aws');
const ConfigManager = require('./helpers/configManager');

// Prep command executor
const { execSync } = require('child_process');
const { updateInferTypeNode } = require('typescript');
const exec = (command, options = {}) => {
  options.stdio = 'inherit';
  console.log(command);
  return execSync(command, options);
};

const promptSync = require('prompt-sync')();
const prompt = (title, notRequired) => {
  const val = promptSync(title);
  if (val === null || (!notRequired && !val)) {
    process.exit(0);
  }
  return val;
};
print.savePrompt(prompt);

const main = async () => {

  const args = minimist(process.argv.slice(2), {
    // allow use of config in an alternate location
    string: [ 'config', 'profile' ],
    boolean: [ 'yes' ],
    alias: { c: 'config', p: 'profile', y: 'yes' },
  });

  // set the AWS api module to use a specified profile
  if (args.profile !== undefined) {
    aws.initProfile(args.profile);
  }

  const configManager = new ConfigManager(args.config);
  if (!configManager.exists()) {
    throw new Error(`No config file at '${args.config}'`);
  }

  const config = configManager.load();
  const secretNamePrefix = config.secretNamePrefix || `/caccl-deploy/${config.appName}`;

  if (config.appEnvironment === undefined) {
    console.log("nothing to do");
    process.exit(0);
  }

  const updatedEnv = Object.assign({}, config.appEnvironment);

  for await (const varname of Object.keys(config.appEnvironment)) {

    const value = config.appEnvironment[varname];
    const secretName = `${secretNamePrefix}/${varname}`;

    if (typeof value !== 'string') {
      throw new Error(`The value of ${varname} must be a string`);
    }

    const doIt = (varname, isUpdate=false) => {
      if (args.yes) return true;
      const action = isUpdate ? 'Update': 'Store';
      const yes = prompt(`${action} ${varname} as ${secretName} in AWS Secrets Manager? [Y/n]`, true);
      return yes.trim().toLowerCase() !== 'n';
    };

    // value exists but looks like it's already an arn
    if (!isArn(value)) {

      let secret;
      const exists = await aws.secretExists(secretName);

      if (exists && doIt(varname, isUpdate=true)) {
        secret = await aws.updateSecret(secretName, value);
        console.log(`SecretsManager entry for ${varname} updated`);
        updatedEnv[varname] = secret.ARN;
      } else if (doIt(varname)) {
        const description = `${varname} value for ${config.appName}`;
        secret = await aws.createSecret(secretName, value, description, config.tags);
        console.log(`SecretsManager entry for ${varname} created with id ${secret.ARN}`);
        updatedEnv[varname] = secret.ARN;
      }
    }
  };

  console.log('Update your deployConfig.js `appEnvironment` with the following?');
  console.log(JSON.stringify(updatedEnv, null, 2));
  const saveIt = prompt('[Y/n]', true);
  if (saveIt.trim().toLowerCase() !== 'n') {
    config.appEnvironment = updatedEnv;
    configManager.save(config);
    console.log(`${configManager.configPath} updated`);
  } else {
    console.log('Update cancelled');
  }
}

const secretExists = (secretName) => {
  const params = {}
};

const isArn = (val) => {
  return val.toLowerCase().startsWith('arn:aws:secretsmanager');
};

main().catch(console.log);
