// Import aws-sdk
import AWS from 'aws-sdk';

// Import logger
import logger from '../../logger.js';

/**
 * delete one or more secretsmanager entries
 * @param {string[]} secretArns
 */
const deleteSecrets = async (secretArns: string[]): Promise<void> => {
  const sm = new AWS.SecretsManager();
  for (let i = 0; i < secretArns.length; i += 1) {
    await sm
      .deleteSecret({
        SecretId: secretArns[i],
        ForceDeleteWithoutRecovery: true,
      })
      .promise();
    logger.log(`secret ${secretArns[i]} deleted`);
  }
};

export default deleteSecrets;
