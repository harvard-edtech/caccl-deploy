import { deleteSecrets, deleteSsmParameters } from '../../aws/index.js';

/**
 * Delete the secrets and SSM parameters associated with a flattened deploy configuration.
 * @author Jay Luker, Benedikt Arnarsson
 * @param ssmPrefix the prefix associated with the deploy configuration
 * @param flattenedConfig the FLATTENED deploy configuration
 * @param profile the AWS profile
 * @returns {Promise<void>} promise to await
 */
const wipeConfig = async (
  ssmPrefix: string,
  flattenedConfig: Record<PropertyKey, string>,
  profile = 'default',
) => {
  const paramsToDelete = Object.keys(flattenedConfig).map((k) => {
    return `${ssmPrefix}/${k}`;
  });
  const secretsToDelete = Object.values(flattenedConfig).reduce(
    (arns: string[], v: string) => {
      if (v.toString().startsWith('arn:aws:secretsmanager')) {
        return [...arns, v];
      }

      return arns;
    },
    [],
  );
  await deleteSsmParameters(paramsToDelete, profile);
  await deleteSecrets(secretsToDelete, profile);
};

export default wipeConfig;
