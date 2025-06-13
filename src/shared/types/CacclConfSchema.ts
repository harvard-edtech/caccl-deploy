/**
 * Configuration schema for caccl-deploy.
 * @author Benedikt Arnarsson
 */
type CacclConfSchema = {
  cfnStackPrefix: string;
  ecrAccessRoleArn: string;
  productionAccounts: string[];
  ssmRootPrefix: string;
};

export default CacclConfSchema;
