/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const promptSync = require('prompt-sync')();
const aws = require('./aws');
const print = require('./print');

const prompt = (title, notRequired) => {
  const val = promptSync(title);
  if (val === null || (!notRequired && !val)) {
    process.exit(0);
  }
  return val;
};
print.savePrompt(prompt);

class ConfigManager {
  constructor() {
    this.deployConfigPath =
      process.env.CACCL_DEPLOY_CONFIG !== undefined
        ? process.env.CACCL_DEPLOY_CONFIG
        : path.join(process.env.PWD, 'config/deployConfig.js');
  }

  getAppNameFromPackage() {
    const packageFile = path.join(this.appDir, 'package.json');
    try {
      return require(packageFile).name;
    } catch (err) {
      console.log("\nOops! Your application's package.json is missing or invalid?");
      process.exit(0);
    }
  }

  exists() {
    return fs.existsSync(this.deployConfigPath);
  }

  load() {
    return require(this.deployConfigPath);
  }

  save(config) {
    fs.writeFileSync(this.deployConfigPath, JSON.stringify(config, null, 2));
  }

  validate() {
    return true;
  }

  async generate() {
    /**
     * Values to collect:
     *   x aws account id (this is not usually part of existing ~/.aws/config)
     *   x aws region (if not configured)
     *   x aws key id (if not configured)
     *   x aws secret key (if not configured)
     *   - cidr block (can we suggest one?)
     *   - number of AZs?
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

    print.title('Deployment Configuration Generator');

    if (!aws.configured()) {
      console.log("Looks like you don't have the awscli configured...");
      console.log('You can do this by visting https://aws.amazon.com/cli/ and following the instructions.');
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

      let cidrBlock;
      const vpcId = prompt("If you have an existing VPC into which you'd like to deploy enter it's id: ", true);

      if (vpcId.trim() == '') {
        console.log('The deployment process will create an AWS VPC which needs ');
        console.log('a network address CIDR block. If you know the CIDR block ');
        console.log('you would like to use enter it now, otherwise hit Enter ');
        console.log('and one will be suggested.');
        cidrBlock = prompt('CIDR Block: ', true);

        while (cidrBlock.trim() === '') {
          const suggestedCidrBlock = await aws.suggestCidrBlock();
          if (suggestedCidrBlock === undefined) {
            console.log('Unable to determine an available cidr block');
            print.enterToContinue();
            process.exit();
          }
          console.log(`It looks like ${suggestedCidrBlock} is available`);
          const yn = prompt('[y]/n: ', true);
          if (yn.trim().toLowerCase() !== 'n') {
            cidrBlock = suggestedCidrBlock;
          }
        }
        console.log(`OK we'll use ${cidrBlock} for your VPC.`);
      }
      console.log('');

      console.log('You can now enter the ARN value for an AWS Certificate Manager certificate.');
      const certificateArn = prompt('certificate ARN: ', true);

      // take the app's name from package.json
      const suggestedStackName = `${this.getAppNameFromPackage()}-deploy`;
      let stackName = prompt(`Name for your deployment stack [${suggestedStackName}]:`, true);
      if (stackName.trim() === '') {
        stackName = suggestedStackName;
      }

      const config = {
        stackName,
        awsAccountId: accountId,
        awsRegion: awsConfig.region,
        awsAccessKeyId: awsConfig.credentials.accessKeyId,
        awsSecretAccessKey: awsConfig.credentials.secretAccessKey,
        cidrBlock,
        certificateArn,
        appEnvironment: {
          CLIENT_ID: '',
          CLIENT_SECRET: '',
          CONSUMER_KEY: '',
          CONSUMER_SECRET: '',
          CANVAS_HOST: '',
        },
      };

      console.log(`About to write your deploy configuration to ${this.deployConfigPath}`);
      console.log(JSON.stringify(config, null, 2));
      print.enterToContinue();
      this.save(config);
    }
  }
}

module.exports = ConfigManager;
