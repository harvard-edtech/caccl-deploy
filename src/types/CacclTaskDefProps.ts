// Import types
import ICacclAppEnvironment from './ICacclAppEnvironment.js';

// TODO: JSDoc
type CacclTaskDefProps = {
  appImage: string;
  proxyImage?: string;
  vpcCidrBlock?: string;
  appEnvironment?: ICacclAppEnvironment;
  taskCpu?: number;
  taskMemory?: number;
  logRetentionDays?: number;
  gitRepoVolume?: Record<string, string>;
};

export default CacclTaskDefProps;
