import { z } from 'zod';

/**
 * Config file type for CACCL deploy.
 * @author Benedikt Arnarsson
 */
const CacclDeployConfig = z.object({
  cfnStackPrefix: z.string().default('CacclDeploy-'),
  ecrAccessRoleArn: z.string().optional(),
  productionAccounts: z.array(z.string()).default([]),
  ssmRootPrefix: z.string().default('/caccl-deploy'),
});

/**
 * Config file type for CACCL deploy.
 * @author Benedikt Arnarsson
 */
type CacclDeployConfig = z.infer<typeof CacclDeployConfig>;

export default CacclDeployConfig;
