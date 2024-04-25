// Import AWS CDK lib
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

// Import types
import CacclCacheOptions from './CacclCacheOptions';
import ICacclAppEnvironment from './ICacclAppEnvironment';

// TODO: JSDoc
type CacclCacheProps = {
  vpc: ec2.Vpc;
  options: CacclCacheOptions;
  appEnv: ICacclAppEnvironment;
};

export default CacclCacheProps;
