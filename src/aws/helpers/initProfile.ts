// Import aws-sdk
import AWS from 'aws-sdk';
import { iniLoader as SharedIniFile } from 'aws-sdk/lib/shared-ini/index.js';

// Import errors
import AwsProfileNotFound from '../../shared/errors/AwsProfileNotFound.js';

/**
 * Initialize the aws-sdk library with credentials from a
 * specific profile.
 * @author Jay Luker
 * @param {string} profileName
 */
const initProfile = (profileName: string) => {
  const awsCredentials = SharedIniFile.loadFrom({});

  if (awsCredentials[profileName] === undefined) {
    throw new AwsProfileNotFound(
      `Tried to init a non-existent profile: '${profileName}'`,
    );
  }
  const profileCreds = awsCredentials[profileName];

  AWS.config.update({
    credentials: new AWS.Credentials({
      accessKeyId: profileCreds.aws_access_key_id,
      secretAccessKey: profileCreds.aws_secret_access_key,
    }),
    region: profileCreds.region,
  });
};

export default initProfile;
