// Import AWS CDK lib
import { StackProps } from 'aws-cdk-lib';

// Import types
import CacclCacheOptions from './CacclCacheOptions';
import CacclDbOptions from './CacclDbOptions';
import CacclLoadBalancerExtraOptions from './CacclLoadBalancerExtraOptions';
import CacclNotificationsProps from './CacclNotificationsProps';
import CacclScheduledTask from './CacclScheduledTask';
import CacclTaskDefProps from './CacclTaskDefProps';

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
