// Import types
import ICacclAppEnvironment from './ICacclAppEnvironment.js';

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
