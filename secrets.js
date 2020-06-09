#!/usr/bin/env node
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const aws = require('./helpers/aws');
const ConfigManager = require('./helpers/configManager');
const print = require('./helpers/print');

// Prep command executor
const { execSync } = require('child_process');
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

const configManager = new ConfigManager();
const config = configManager.load();
const secretNamePrefix = config.secretNamePrefix || `/caccl-deploy/${config.appName}`;
const updatedEnv = {};

Object.entries(config.appEnvironment || {}).forEach(async ([key, valueOrArn]) => {
  // value exists but looks like it's already an arn
  if (valueOrArn.toLowerCase().startsWith('arn:aws:secretsmanager')) {
    console.log(`${key} is already in SecretsManager`);
    const update = prompt(`Update value of ${key}? [y/N]`, true);
    if (update.trim().toLowerCase() === 'y') {
      const newValue = prompt('Enter new value: ');
      const secret = await aws.updateSecret(valueOrArn, newValue);
      console.log(`SecretsManager entry for ${key} created with id ${secret.ARN}`);
      updatedEnv[key] = secret.ARN;
    }
    // value exists
  } else if (valueOrArn.length > 0) {
    const create = prompt(`Store ${key} as an AWS Secrets Manager entry? [Y/n]`, true);
    if (create.trim().toLowerCase() !== 'n') {
      const secretName = `${secretNamePrefix}/${key}`;
      const description = `${key} value for ${config.appName}`;
      const secret = await aws.createSecret(secretName, valueOrArn, description, config.tags);
      console.log(`SecretsManager entry ${secret.ARN} updated`);
      updatedEnv[key] = secret.ARN;
    }
    // no value
  } else {
    console.log(`no value configured for ${key}`);
  }
});

console.log('Update your deployConfig.js `appEnvironment` with the following:');
console.log(JSON.stringify(updatedEnv, null, 2));
