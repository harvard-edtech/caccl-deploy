// Import shared types
import { DeployConfigData } from '../../types/index.js';

/**
 * Parse a DeployConfigData from a generic key-value object.
 * @author Jay Luker
 * @author Benedikt Arnarsson
 * @param data
 * @returns
 */
const create = (data: Record<string, any>): DeployConfigData => {
  return DeployConfigData.parse(data);
};

export default create;
