// Import aws-sdk
import AWS from 'aws-sdk';

/**
 * Confirm that a secretsmanager entry exists
 * @param {string} secretName
 * @returns {boolean}
 */
const secretExists = async (secretName: string): Promise<boolean> => {
  const sm = new AWS.SecretsManager();
  const params = {
    Filters: [
      {
        Key: 'name',
        Values: [secretName],
      },
    ],
  };

  const resp = await sm.listSecrets(params).promise();
  return !!resp.SecretList && resp.SecretList.length > 0;
};

export default secretExists;
