import { DeleteParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

import Logger from '../../logger.js';

/**
 * Delete one or more parameter store entries
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string[]} paramNames parameters to delete.
 * @param {string} [profile='default'] AWS profile to use.
 * @returns {Promise<void>} promise to await.
 */
const deleteSsmParameters = async (
  paramNames: string[],
  profile = 'default',
) => {
  const client = new SSMClient({ profile });
  const maxParams = 10;
  let idx = 0;
  while (idx < paramNames.length) {
    const paramNamesSlice = paramNames.slice(idx, maxParams + idx);
    idx += maxParams;
    const command = new DeleteParametersCommand({
      Names: paramNamesSlice,
    });
    await client.send(command);
    for (const name of paramNamesSlice) {
      Logger.log(`ssm parameter ${name} deleted`);
    }
  }
};

export default deleteSsmParameters;
