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
  generate: () => {
    /**
     * Values to collect:
     *   - aws account id (this is not usually part of existing ~/.aws/config)
     *   - aws region (if not configured)
     *   - aws key id (if not configured)
     *   - aws secret key (if not configured)
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
    let cidrBlock;

    if (!aws.configured()) {
      console.log('Looks like you don\'t have the awscli configured...');
      console.log('You can do this now by visting https://aws.amazon.com/cli/.');
      console.log('Otherwise you may continue by entering your AWS account details manually.');
      print.enterToContinue();

      accessKeyId = prompt('AWS Access Key: ');
      secretAccessKey = prompt('AWS Secret Access Key: ');
      accountId = prompt('AWS Account ID: ');
      awsRegion = prompt('AWS region, e.g. "us-east-1": ');

    } else {

      let useProfile;
      const profiles = aws.getProfileNames();

      if (profiles.length === 1) {
        useProfile = profiles[0];
      } else {
        while (useProfile === undefined) {
          console.log('Choose which AWS profile to use:');
          profiles.forEach((profileName, idx) => {
            console.log(`${idx + 1} - ${profileName}`);
          });
          const profileChoice = parseInt(prompt('profile: '));
          if (profiles[profileChoice - 1] === undefined) {
            console.log('Invalid profile choice');
          } else {
            useProfile = profiles[profileChoice - 1];
          }
        }
      }
      console.log(`OK we're going to use the ${useProfile} profile!`);
      const awsConfig = aws.initConfig(useProfile);

      print.enterToContinue();
    }
  },
  validate: () => {

  }
}
