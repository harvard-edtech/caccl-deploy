import {
  ListSecretsCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

/**
 * Confirm that an AWS SecretsManager entry exists
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} secretName name of the secret whose existence we are checking.
 * @param {string} [profile='default'] AWS profile
 * @returns {Promise<boolean>} whether the secret exists or not
 */
const secretExists = async (
  secretName: string,
  profile = 'default',
): Promise<boolean> => {
  const client = new SecretsManagerClient({ profile });
  const command = new ListSecretsCommand({
    Filters: [
      {
        Key: 'name',
        Values: [secretName],
      },
    ],
  });

  const resp = await client.send(command);
  return !!resp.SecretList && resp.SecretList.length > 0;
};

export default secretExists;
