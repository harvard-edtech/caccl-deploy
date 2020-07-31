/* eslint-disable no-console */
const untilidfy = require('untildify');
const AWS = require('aws-sdk');
const SharedIniFile = require('aws-sdk/lib/shared-ini').iniLoader;

let awsProfiles;
let awsCredentials;

try {
  // try loading the profiles/creds
  awsCredentials = SharedIniFile.loadFrom();
  awsProfiles = SharedIniFile.loadFrom({
    filename: untilidfy('~/.aws/config'),
  });
} catch (err) {
  // ingore if error is due to missing credentials;
  if (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials')) {
    throw err;
  }
  awsProfiles = {};
  awsCredentials = {};
}

module.exports = {
  configured: () => {
    // existence of profiles == credentials have been configured
    return Object.keys(awsCredentials).length > 0;
  },

  getProfileNames: () => {
    return Object.keys(awsCredentials);
  },

  initProfile: (profileName) => {
    if (awsCredentials[profileName] === undefined) {
      throw new Error(`Tried to init a non-existent profile: ${profileName}`);
    }

    const profileCreds = awsCredentials[profileName];

    const awsConfig = {
      credentials: new AWS.Credentials({
        accessKeyId: profileCreds.aws_access_key_id,
        secretAccessKey: profileCreds.aws_secret_access_key,
      }),
      // set a default in case the profile region isn't configured
      region: process.env. AWS_REGION || 'us-east-1',
    };

    /**
     * depending on the user's environment/setup the profile keys can either be
     * just the profile name or the profile name prefixed with 'profile' :p
     */
    const profileConfig = awsProfiles[profileName] || awsProfiles[`profile ${profileName}`];

    if (profileConfig !== undefined && profileConfig.region !== undefined) {
      awsConfig.region = profileConfig.region;
    };

    AWS.config.update(awsConfig);
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

  createSecret: async (secretName, secretValue, secretDescription, tags) => {
    const sm = new AWS.SecretsManager();
    const params = {
      Name: secretName,
      SecretString: secretValue,
    };

    if (secretDescription !== undefined) {
      params.Description = secretDescription;
    }

    if (tags !== undefined) {
      params.Tags = Object.entries(tags).map(([k, v]) => {
        return { Key: k, Value: v };
      });
    }

    let resp;
    try {
      resp = await sm.createSecret(params).promise();
    } catch (err) {
      console.error(err);
      return err;
    }
    return resp;
  },

  updateSecret: async (secretArn, secretValue, secretDescription) => {
    const sm = new AWS.SecretsManager();
    const params = {
      SecretId: secretArn,
      SecretString: secretValue,
    };

    if (secretDescription !== undefined) {
      params.Description = secretDescription;
    }

    let resp;
    try {
      resp = await sm.updateSecret(params).promise();
    } catch (err) {
      console.error(err);
      return err;
    }
    return resp;
  },
};

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
