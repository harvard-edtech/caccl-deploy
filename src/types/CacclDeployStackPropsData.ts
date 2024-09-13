// Import zod
import { z } from 'zod';

// Import types
import DeployConfigData from './DeployConfigData.js';

const CacclDeployStackPropsData = z.object({
  albLogBucketName: z.string().optional(),
  awsAccountId: z.string().optional(),
  awsRegion: z.string().optional(),
  cacclDeployVersion: z.string(),
  deployConfig: DeployConfigData,
  deployConfigHash: z.string(),
  ecsClusterName: z.string().optional(),
  stackName: z.string(),
  vpcId: z.string().optional(),
});

type CacclDeployStackPropsData = z.infer<typeof CacclDeployStackPropsData>;

export default CacclDeployStackPropsData;
