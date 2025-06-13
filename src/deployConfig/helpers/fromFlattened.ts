import flat from 'flat';

import { DeployConfigData } from '../../types/index.js';
import create from './create.js';

/**
 * Construct a DeployConfigData from a flattened set of parameters.
 * Primarily used for parsing the SSM values.
 * @author Jay Luker
 * @param {Record<string, string>} flattenedData flattened, key-value configuration
 * @returns {DeployConfigData} unflattened deploy configuration
 */
const fromFlattened = (
  flattenedData: Record<string, string>,
): DeployConfigData => {
  const unflattened: Record<string, any> = flat.unflatten(flattenedData, {
    delimiter: '/',
  });
  return create(unflattened);
};

export default fromFlattened;
