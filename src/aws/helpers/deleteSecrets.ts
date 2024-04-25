// Import aws-sdk
import AWS from 'aws-sdk';

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
    console.log(`secret ${secretArns[i]} deleted`);
  }
};

export default deleteSecrets;
