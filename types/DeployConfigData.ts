// Import Zod
import { z } from 'zod';

// Import shared types
import CacclCacheOptions from './CacclCacheOptions';
import CacclDbOptions from './CacclDbOptions';
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions';
import CacclNotificationsProps from './CacclNotificationsProps';
import CacclScheduledTask from './CacclScheduledTask';

const DeployConfigData = z.object({
  //
  appImage: z.string(),
  proxyImage: z.string().optional(),
  taskCpu: z.number().optional(),
  taskMemory: z.number().optional(),
  logRetentionDays: z.number().optional(),
  gitRepoVolume: z.object({}).catchall(z.string()).optional(),
  // CloudFormation infrastructure stack name
  infraStackName: z.string(),
  // Container image ARN
  notifications: CacclNotificationsProps.optional(),
  certificateArn: z.string().optional(),
  appEnvironment: z.object({}).catchall(z.string()).optional(),
  tags: z.object({}).catchall(z.string()).optional(),
  scheduledTasks: z.object({}).catchall(CacclScheduledTask).optional(),
  taskCount: z.string(),
  firewallSgId: z.string().optional(),
  lbOptions: CacclLoadBalancerExtraOptions.optional(),
  cacheOptions: CacclCacheOptions.optional(),
  dbOptions: CacclDbOptions.optional(),
  enableExecuteCommand: z.union([z.string(), z.boolean()]).optional(),
  // DEPRECATED:
  docDb: z.any(),
  docDbInstanceCount: z.number().optional(),
  docDbInstanceType: z.string().optional(),
  docDbProfiler: z.boolean().optional(),
});

/**
 * Type describing the deploy configuration data (saved in SSM).
 * @author Benedikt Arnarsson
 */
type DeployConfigData = z.infer<typeof DeployConfigData>;

export default DeployConfigData;
