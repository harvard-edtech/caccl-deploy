/**
 * Configuration schema for caccl-deploy.
 * @author Benedikt Arnarsson
 */
type CacclConfSchema = {
  ssmRootPrefix: string;
  ecrAccessRoleArn: string;
  cfnStackPrefix: string;
  productionAccounts: string[];
};

export default CacclConfSchema;
