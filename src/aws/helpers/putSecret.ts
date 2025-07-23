import {
  CreateSecretCommand,
  SecretsManagerClient,
  TagResourceCommand,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

import type { AwsTag } from '../../shared/types/AwsTag.js';
import type { SecretOpts } from '../../shared/types/SecretOpts.js';

import logger from '../../logger.js';
import ExistingSecretWontDelete from '../../shared/errors/ExistingSecretWontDelete.js';
import SecretNotCreated from '../../shared/errors/SecretNotCreated.js';
import sleep from '../../shared/helpers/sleep.js';
import secretExists from './secretExists.js';

type PutSecretOpts = {
  profile?: string;
  retries?: number;
  secretOpts: SecretOpts;
  tags: AwsTag[];
};

/**
 * creates or updates a secrets manager entry
 * NOTE: the update + tagging operation is NOT atomic! I wish the
 *   sdk made this easier
 * @author Jay Luker
 * @param {PutSecretOpts} opts put secret options
 * @param {SecretOpts} [opts.secretOpts] - secret entry options
 * @param {string} [opts.secretOpts.Name] - name of the secrets manager entry
 * @param {string} [opts.secretOpts.Description] - description of the entry
 * @param {string} [opts.secretOpts.SecretString] - value of the secret
 * @param {array} [opts.tags=[]] - aws tags [{ Name: '...', Value: '...'}]
 * @param {number} [opts.retries=0] number of retries that have been done for putting the secret. Max 5.
 * @param {string} [opts.profile='default'] AWS profile.
 * @returns {string} - the secretsmanager entry ARN
 */
const putSecret = async (opts: PutSecretOpts): Promise<string> => {
  const { profile = 'default', retries = 0, secretOpts, tags } = opts;
  const client = new SecretsManagerClient({ profile });

  const { Description, Name: SecretId, SecretString } = secretOpts;

  let secretResp;
  try {
    const exists = await secretExists(SecretId, profile);
    if (exists) {
      const updateSecretCommand = new UpdateSecretCommand({
        Description,
        SecretId,
        SecretString,
      });
      secretResp = await client.send(updateSecretCommand);

      logger.log(`secretsmanager entry ${SecretId} updated`);

      if (tags.length > 0) {
        const tagResourceCommand = new TagResourceCommand({
          SecretId,
          Tags: tags,
        });
        await client.send(tagResourceCommand);
        logger.log(`secretsmanager entry ${SecretId} tagged`);
      }
    } else {
      const createSecretCommand = new CreateSecretCommand({
        Description,
        Name: SecretId,
        SecretString,
        Tags: tags,
      });
      secretResp = await client.send(createSecretCommand);
      logger.log(`secretsmanager entry ${SecretId} created`);
    }
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;
    if (error.message.includes('already scheduled for deletion')) {
      if (retries < 5) {
        const newRetries = retries + 1;
        await sleep(2 ** retries * 1000);
        return putSecret({ profile, retries: newRetries, secretOpts, tags });
      }

      console.error('putSecret failed after 5 retries');
      throw new ExistingSecretWontDelete(
        `Failed to overwrite existing secret ${SecretId}`,
      );
    }

    throw error;
  }

  if (!secretResp.ARN)
    throw new SecretNotCreated(`Could not create secret ${SecretId}`);
  return secretResp.ARN;
};

export default putSecret;
