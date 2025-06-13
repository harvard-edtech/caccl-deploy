import { StackProps } from 'aws-cdk-lib';

import CacclCacheOptions from './CacclCacheOptions.js';
import CacclDbOptions from './CacclDbOptions.js';
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';
import CacclNotificationsProps from './CacclNotificationsProps.js';
import CacclScheduledTask from './CacclScheduledTask.js';
import CacclTaskDefProps from './CacclTaskDefProps.js';

/**
 * Props for constructing a full application stack with CACCL deploy.
 * @author Benedikt Arnarsson
 */
interface CacclDeployStackProps extends StackProps {
  albLogBucketName?: string;
  appEnvironment: Record<string, string>;
  cacheOptions?: CacclCacheOptions;
  certificateArn?: string;
  dbOptions?: CacclDbOptions;
  ecsClusterName?: string;
  enableExecuteCommand?: boolean;
  firewallSgId?: string;
  lbOptions?: CacclLoadBalancerExtraOptions;
  notifications: Partial<CacclNotificationsProps>;
  scheduledTasks?: Record<string, CacclScheduledTask>;
  taskCount: number;
  taskDefProps: CacclTaskDefProps;
  vpcId?: string;
}

export default CacclDeployStackProps;
