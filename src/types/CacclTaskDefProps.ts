import type { ICacclAppEnvironment } from './ICacclAppEnvironment.js';

/**
 * Task definition properties for CDK with CACCL deploy.
 * @author Benedikt Arnarsson
 */
export type CacclTaskDefProps = {
  appEnvironment?: ICacclAppEnvironment;
  appImage: string;
  gitRepoVolume?: Record<string, string>;
  logRetentionDays?: number;
  proxyImage?: string;
  taskCpu?: number;
  taskMemory?: number;
  vpcCidrBlock?: string;
};
