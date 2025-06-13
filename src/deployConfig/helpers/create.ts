import { DeployConfigData } from '../../types/index.js';

/**
 * Parse a DeployConfigData from a generic key-value object.
 * @author Jay Luker
 * @author Benedikt Arnarsson
 * @param {Record<string, string>} data raw data to be parsed into deploy configuration
 * @returns {DeployConfigData} parsed out deploy configuration
 */
const create = (data: Record<string, any>): DeployConfigData => {
  return DeployConfigData.parse(data);
};

export default create;
