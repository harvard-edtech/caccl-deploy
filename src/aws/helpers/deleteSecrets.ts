import {
  DeleteSecretCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import logger from '../../logger.js';

/**
 * Delete one or more SecretsManager entries.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string[]} secretArns ARNs fo the secrets we are deleting.
 * @param {string} [profile='default] AWS profile to use.
 * @return {Promise<void>} promise to await.
 */
const deleteSecrets = async (
  secretArns: string[],
  profile = 'default',
): Promise<void> => {
  const client = new SecretsManagerClient({ profile });
  for (const secretArn of secretArns) {
    const command = new DeleteSecretCommand({
      ForceDeleteWithoutRecovery: true,
      SecretId: secretArn,
    });
    await client.send(command);
    logger.log(`secret ${secretArn} deleted`);
  }
};

export default deleteSecrets;
