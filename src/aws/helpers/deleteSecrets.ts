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
  for (const secretArn of secretArns) {
    await sm
      .deleteSecret({
        ForceDeleteWithoutRecovery: true,
        SecretId: secretArn,
      })
      .promise();
    logger.log(`secret ${secretArn} deleted`);
  }
};

export default deleteSecrets;
