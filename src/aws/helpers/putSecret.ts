// Import aws-sdk
import AWS from 'aws-sdk';

// Import shared errors
import secretExists from './secretExists';
import ExistingSecretWontDelete from '../../shared/errors/ExistingSecretWontDelete';

// Import shared errors
import SecretNotCreated from '../../shared/errors/SecretNotCreated';

// Import shared helpers
import sleep from '../../shared/helpers/sleep';

// Import shared types
import AwsTag from '../../shared/types/AwsTag';
import SecretOpts from '../../shared/types/SecretOpts';

// Import helpers

/**
 * creates or updates a secrets manager entry
 * NOTE: the update + tagging operation is NOT atomic! I wish the
 *   sdk made this easier
 * @author Jay Luker
 * @param {object} [secretOpts={}] - secret entry options
 * @param {string} [secretOpts.Name] - name of the secrets manager entry
 * @param {string} [secretOpts.Description] - description of the entry
 * @param {string} [secretOpts.SecretString] - value of the secret
 * @param {array} [tags=[]] - aws tags [{ Name: '...', Value: '...'}]
 * @returns {string} - the secretsmanager entry ARN
 */
const putSecret = async (
  secretOpts: SecretOpts,
  tags: AwsTag[],
  retries = 0,
): Promise<string> => {
  const sm = new AWS.SecretsManager();

  const { Name: SecretId, Description, SecretString } = secretOpts;

  let secretResp;
  try {
    const exists = await secretExists(SecretId);
    if (exists) {
      secretResp = await sm
        .updateSecret({
          SecretId,
          Description,
          SecretString,
        })
        .promise();

      console.log(`secretsmanager entry ${SecretId} updated`);

      if (tags.length) {
        await sm
          .tagResource({
            SecretId,
            Tags: tags,
          })
          .promise();
        console.log(`secretsmanager entry ${SecretId} tagged`);
      }
    } else {
      secretResp = await sm
        .createSecret({
          Name: SecretId,
          Description,
          SecretString,
          Tags: tags,
        })
        .promise();
      console.log(`secretsmanager entry ${SecretId} created`);
    }
  } catch (err: unknown) {
    if (!(err instanceof Error)) throw err;
    if (err.message.includes('already scheduled for deletion')) {
      if (retries < 5) {
        // eslint-disable-next-line no-param-reassign
        retries += 1;
        await sleep(2 ** retries * 1000);
        return putSecret(secretOpts, tags, retries);
      }
      console.error('putSecret failed after 5 retries');
      throw new ExistingSecretWontDelete(
        `Failed to overwrite existing secret ${SecretId}`,
      );
    }
    throw err;
  }
  if (!secretResp.ARN)
    throw new SecretNotCreated(`Could not create secret ${SecretId}`);
  return secretResp.ARN;
};

export default putSecret;
