// Import AWS CDK lib
import { StackProps } from 'aws-cdk-lib';

// Import types
import CacclCacheOptions from './CacclCacheOptions.js';
import CacclDbOptions from './CacclDbOptions.js';
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions.js';
import CacclNotificationsProps from './CacclNotificationsProps.js';
import CacclScheduledTask from './CacclScheduledTask.js';
import CacclTaskDefProps from './CacclTaskDefProps.js';

// TODO: JSDoc
interface CacclDeployStackProps extends StackProps {
  vpcId?: string;
  certificateArn?: string;
  ecsClusterName?: string;
  appEnvironment: Record<string, string>;
  taskDefProps: CacclTaskDefProps;
  taskCount: number;
  notifications: Partial<CacclNotificationsProps>;
  albLogBucketName?: string;
  cacheOptions?: CacclCacheOptions;
  dbOptions?: CacclDbOptions;
  scheduledTasks?: Record<string, CacclScheduledTask>;
  lbOptions?: CacclLoadBalancerExtraOptions;
  firewallSgId?: string;
  enableExecuteCommand?: boolean;
}

export default CacclDeployStackProps;
