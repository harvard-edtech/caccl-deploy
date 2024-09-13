// Import AWS CDK lib
import { StackProps } from 'aws-cdk-lib';

// Import types
import CacclCacheOptions from './CacclCacheOptions.js';
import CacclDbOptions from './CacclDbOptions.js';
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';
import CacclNotificationsProps from './CacclNotificationsProps.js';
import CacclScheduledTask from './CacclScheduledTask.js';
import CacclTaskDefProps from './CacclTaskDefProps.js';

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
