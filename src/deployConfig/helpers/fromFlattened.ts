// Import flat
import flat from 'flat';

// Import shared types
import create from './create';
import { DeployConfigData } from '../../../types';

// Import helpers

/**
 * Construct a DeployConfigData from a flattened set of parameters.
 * Primarily used for parsing the SSM values.
 * @author Jay Luker
 * @param flattenedData
 * @returns
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
