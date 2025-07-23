import CacclDeployConfig from './CacclDeployConfig.js';

/**
 * CACCL deploy CLI context, containing flags and config.
 * @author Benedikt Arnarsson
 */
export type CacclDeployContext = {
  yes: boolean;
} & CacclDeployConfig;
