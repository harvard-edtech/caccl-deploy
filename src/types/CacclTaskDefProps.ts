import ICacclAppEnvironment from './ICacclAppEnvironment.js';

/**
 * Task definition properties for CDK with CACCL deploy.
 * @author Benedikt Arnarsson
 */
type CacclTaskDefProps = {
  appEnvironment?: ICacclAppEnvironment;
  appImage: string;
  gitRepoVolume?: Record<string, string>;
  logRetentionDays?: number;
  proxyImage?: string;
  taskCpu?: number;
  taskMemory?: number;
  vpcCidrBlock?: string;
};

export default CacclTaskDefProps;
