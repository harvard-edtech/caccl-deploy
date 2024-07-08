// Import zod
import { z } from 'zod';

// Import types
import DeployConfigData from './DeployConfigData.js';

const CacclDeployStackPropsData = z.object({
  stackName: z.string(),
  vpcId: z.string().optional(),
  ecsClusterName: z.string().optional(),
  albLogBucketName: z.string().optional(),
  awsRegion: z.string().optional(),
  awsAccountId: z.string().optional(),
  cacclDeployVersion: z.string(),
  deployConfigHash: z.string(),
  deployConfig: DeployConfigData,
});

type CacclDeployStackPropsData = z.infer<typeof CacclDeployStackPropsData>;

export default CacclDeployStackPropsData;
