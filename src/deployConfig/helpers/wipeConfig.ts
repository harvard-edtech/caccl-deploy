// Import from aws
import { deleteSecrets, deleteSsmParameters } from '../../aws';

// FIXME: better typing - the Proxy object that wraps config implements the flatten
const wipeConfig = async (
  ssmPrefix: string,
  flattenedConfig: Record<PropertyKey, string>,
) => {
  const paramsToDelete = Object.keys(flattenedConfig).map((k) => {
    return `${ssmPrefix}/${k}`;
  });
  const secretsToDelete = Object.values(flattenedConfig).reduce(
    (arns: string[], v) => {
      if (v.toString().startsWith('arn:aws:secretsmanager')) {
        arns.push(v);
      }
      return arns;
    },
    [],
  );
  await deleteSsmParameters(paramsToDelete);
  await deleteSecrets(secretsToDelete);
};

export default wipeConfig;
