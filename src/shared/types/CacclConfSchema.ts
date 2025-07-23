/**
 * Configuration schema for caccl-deploy.
 * @author Benedikt Arnarsson
 */
export type CacclConfSchema = {
  cfnStackPrefix: string;
  ecrAccessRoleArn: string;
  productionAccounts: string[];
  ssmRootPrefix: string;
};
