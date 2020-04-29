/* eslint-disable no-console */
const untilidfy = require('untildify');
const SharedIniFile = require('aws-sdk/lib/shared-ini').iniLoader;

// this will be assigned the sdk module if it loads/imports successfully
let AWS;
let awsProfiles;
let awsCredentials;

try {
  // this fails with an ENOENT error if ~/.aws/credentials doesn't exist
  // also it needs to be loaded prior to the profile loading below
  AWS = require('aws-sdk');

  // if we get here it's ok to try loading the profiles/creds
  awsCredentials = SharedIniFile.loadFrom();
  awsProfiles = SharedIniFile.loadFrom({
    filename: untilidfy('~/.aws/config'),
  });
} catch (err) {
  // ingore if error is from failed credentials loading
  if (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials')) {
    throw err;
  }
  awsProfiles = {};
  awsCredentials = {};
}

async function getTakenCidrBlocks() {
  const ec2 = new AWS.EC2();
  const takenBlocks = [];
  async function fetchBlocks(nextToken) {
    const params = nextToken !== undefined ? { NextToken: nextToken } : {};
    const vpcResp = await ec2.describeVpcs(params).promise();
    vpcResp.Vpcs.forEach((vpc) => {
      vpc.CidrBlockAssociationSet.forEach((cbaSet) => {
        const truncatedBlock = cbaSet.CidrBlock.slice(0, cbaSet.CidrBlock.lastIndexOf('.'));
        if (!takenBlocks.includes(truncatedBlock)) {
          takenBlocks.push(truncatedBlock);
        }
      });
    });
    if (vpcResp.NextToken !== undefined) {
      await fetchBlocks(vpcResp.NextToken);
    }
  }
  await fetchBlocks();
  return takenBlocks;
}

module.exports = {
  configured: () => {
    // existence of profiles == credentials have been configured
    return Object.keys(awsCredentials).length > 0;
  },

  getProfileNames: () => {
    return Object.keys(awsCredentials);
  },

  initConfig: (profileName) => {
    const creds = new AWS.SharedIniFileCredentials({ profile: profileName });
    /**
     * depending on the user's environment/setup the profile keys can either be
     * just the profile name or the profile name prefixed with 'profile' :p
     */
    const profileConfig = awsProfiles[profileName] || awsProfiles[`profile ${profileName}`];
    AWS.config.update({
      credentials: creds,
      region: profileConfig.region,
    });
    return AWS.config;
  },
  getAccountId: async () => {
    const sts = new AWS.STS();
    let identity;
    try {
      identity = await sts.getCallerIdentity({}).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
    return identity.Account;
  },
  suggestCidrBlock: async () => {
    const takenCidrBlocks = await getTakenCidrBlocks();
    const possibleCidrBlocks = [...Array(254).keys()].map((i) => {
      return `10.2.${i}`;
    });
    const availableCidrBlocks = possibleCidrBlocks.filter((cb) => {
      return !takenCidrBlocks.includes(cb);
    });
    if (availableCidrBlocks.length) {
      // return a random pick
      const randomPick = availableCidrBlocks[Math.floor(Math.random() * availableCidrBlocks.length)];
      return `${randomPick}.0/24`;
    }
  },
};
