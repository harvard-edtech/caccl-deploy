import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import SecretNotFound from '../../shared/errors/SecretNotFound.js';

/**
 * Fetch the secret value for a AWS SecretsManager entry
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} secretArn ARN for the secret that we are fetching.
 * @param {string} [profile='default'] AWS profile
 * @returns {string} secret value
 */
const resolveSecret = async (
  secretArn: string,
  profile = 'default',
): Promise<string> => {
  const client = new SecretsManagerClient({ profile });
  const command = new GetSecretValueCommand({
    SecretId: secretArn,
  });
  const resp = await client.send(command);
  if (!resp.SecretString)
    throw new SecretNotFound(
      `Could not find value for secret: arn=${secretArn}`,
    );
  return resp.SecretString;
};

export default resolveSecret;
