import { z } from 'zod';

import CacclCacheOptions from './CacclCacheOptions.js';
import CacclDbOptions from './CacclDbOptions.js';
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';
import CacclNotificationsProps from './CacclNotificationsProps.js';
import CacclScheduledTask from './CacclScheduledTask.js';

/**
 * Data needed to construct a deploy configuration (for reading from files or other sources).
 * @author Benedikt Arnarsson
 */
const DeployConfigData = z.object({
  appEnvironment: z.object({}).catchall(z.string()).optional(),
  //
  appImage: z.string(),
  cacheOptions: CacclCacheOptions.optional(),
  certificateArn: z.string().optional(),
  dbOptions: CacclDbOptions.optional(),
  // DEPRECATED:
  docDb: z.any(),
  docDbInstanceCount: z.coerce.number().optional(),
  docDbInstanceType: z.string().optional(),
  docDbProfiler: z.coerce.boolean().optional(),
  enableExecuteCommand: z.union([z.string(), z.boolean()]).optional(),
  firewallSgId: z.string().optional(),
  gitRepoVolume: z.object({}).catchall(z.string()).optional(),
  // CloudFormation infrastructure stack name
  infraStackName: z.string(),
  lbOptions: CacclLoadBalancerExtraOptions.optional(),
  logRetentionDays: z.coerce.number().optional(),
  // Container image ARN
  notifications: CacclNotificationsProps.optional(),
  proxyImage: z.string().optional(),
  scheduledTasks: z.record(z.string(), CacclScheduledTask).optional(),
  tags: z.object({}).catchall(z.string()).optional(),
  taskCount: z.string().default('1'),
  taskCpu: z.coerce.number().optional(),
  taskMemory: z.coerce.number().optional(),
});

/**
 * Type describing the deploy configuration data (saved in SSM or other sources).
 * @author Benedikt Arnarsson
 */
type DeployConfigData = z.infer<typeof DeployConfigData>;

export default DeployConfigData;
