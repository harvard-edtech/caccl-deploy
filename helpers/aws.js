/* eslint-disable no-console */
const untilidfy = require('untildify');
const SharedIniFile = require('aws-sdk/lib/shared-ini').iniLoader;

let AWS;
let awsProfiles;

try {
  // this fails with an ENOENT error if ~/.aws/credentials doesn't exist
  // also it needs to be loaded prior to the profile loading below
  AWS = require('aws-sdk');

  // if we get here it's ok to try loading the profiles/creds
  awsProfiles = SharedIniFile.loadFrom();
} catch (err) {
  // ingore if error is from failed credentials loading
  if (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials')) {
    throw err;
  }
  awsProfiles = {};
}

module.exports = {

  configured: () => {
    // existence of profiles == credentials have been configured
    return Object.keys(awsProfiles).length > 0;
  },

  getProfileNames: () => {
    return Object.keys(awsProfiles);
  },

  initConfig: (profileName) => {
    const creds = new AWS.SharedIniFileCredentials({profile: profileName});
    const profileConfig = SharedIniFile.loadFrom({
      filename: untilidfy('~/.aws/config'),
    });
    AWS.config.update({
      credentials: creds,
      region: profileConfig[profileName].region,
    });
    return AWS.config;
  },

};
