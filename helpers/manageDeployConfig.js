/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const promptSync = require('prompt-sync')();
const aws = require('./aws');
const print = require('./print');

const currDir = process.env.PWD;
const deployConfigFile = path.join(currDir, 'config/deployConfig.json');

const prompt = (title, notRequired) => {
  const val = promptSync(title);
  if (val === null || (!notRequired && !val)) {
    process.exit(0);
  }
  return val;
};
print.savePrompt(prompt);

module.exports = {
  exists: () => {
    return fs.existsSync(deployConfigFile);
  },
  load: () => {

  },
  generate: async () => {
    /**
     * Values to collect:
     *   x aws account id (this is not usually part of existing ~/.aws/config)
     *   x aws region (if not configured)
     *   x aws key id (if not configured)
     *   x aws secret key (if not configured)
     *   - cidr block (can we suggest one?)
     *   - certificate arn
     *   - app hostname?
     *   - app env vars
     *    - client id
     *    - client secret
     *    - canvas host
     *    - consumer key
     *    - consumer secret
     *    - extras, e.g. MONGO_LOGS
     */

    let accessKeyId;
    let secretAccessKey;
    let accountId;
    let awsRegion;
    let cidrBlock = '';

    if (!aws.configured()) {
      console.log('Looks like you don\'t have the awscli configured...');
      console.log('You can do this by visting https://aws.amazon.com/cli/.');
      console.log('Otherwise you may continue by entering your AWS account details manually.');
      print.enterToContinue();

      accessKeyId = prompt('AWS Access Key: ');
      secretAccessKey = prompt('AWS Secret Access Key: ');
      accountId = prompt('AWS Account ID: ');
      awsRegion = prompt('AWS region, e.g. "us-east-1": ');

    } else {

      let whichProfile;
      const profiles = aws.getProfileNames();

      if (profiles.length === 1) {
        whichProfile = profiles[0];
      } else {
        while (whichProfile === undefined) {
          console.log('Choose which AWS profile to use:');
          profiles.forEach((profileName, idx) => {
            console.log(`${idx + 1} - ${profileName}`);
          });
          const profileChoice = parseInt(prompt('profile: '));
          if (profiles[profileChoice - 1] === undefined) {
            console.log('Invalid profile choice');
          } else {
            whichProfile = profiles[profileChoice - 1];
          }
        }
      }

      console.log(`OK we're going to use the ${whichProfile} profile!`);
      const awsConfig = aws.initConfig(whichProfile);

      console.log('Determining your AWS account id...');
      const accountId = await aws.getAccountId();
      console.log(`Looks like your account id is ${accountId}`);

      console.log('The deployment process will create an AWS VPC which needs ');
      console.log('a network address CIDR block. If you know the CIDR block ');
      console.log('you would like to use enter it now, otherwise hit Enter ');
      console.log('and one will be suggested.');
      cidrBlock = prompt('CIDR Block: ', true);

      while (cidrBlock.trim() === '') {
        const suggestedCidrBlock = await aws.suggestCidrBlock();
        if (suggestedCidrBlock === undefined) {
          console.log('Unable to determine an available cidr block');
          prompt.enterToContinue();
          process.exit();
        }
        console.log(`It looks like ${suggestedCidrBlock} is available`);
        const yn = prompt('[y]/n: ', true);
        if (yn.trim().toLowerCase() !== 'n') {
          cidrBlock = suggestedCidrBlock;
        }
      }
      console.log(`Great! We'll use ${cidrBlock} for your VPC.`);
    }
  },
  validate: () => {

  }
}
