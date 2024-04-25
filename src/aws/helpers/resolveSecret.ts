// Import aws-sdk
import AWS from 'aws-sdk';

// Import shared errors
import SecretNotFound from '../../shared/errors/SecretNotFound';

/**
 * Fetch the secret value for a secretsmanager entry
 * @author Jay Luker
 * @param {string} secretArn
 * @returns {string}
 */
const resolveSecret = async (secretArn: string): Promise<string> => {
  const sm = new AWS.SecretsManager();
  const resp = await sm
    .getSecretValue({
      SecretId: secretArn,
    })
    .promise();
  if (!resp.SecretString)
    throw new SecretNotFound(
      `Could not find value for secret: arn=${secretArn}`,
    );
  return resp.SecretString;
};

export default resolveSecret;
