import CacclDeployConfig from './CacclDeployConfig.js';

/**
 * CACCL deploy CLI context, containing flags and config.
 * @author Benedikt Arnarsson
 */
type CacclDeployContext = {
  profile: string;
  yes: boolean;
} & CacclDeployConfig;

export default CacclDeployContext;
