// Import AWS CDK lib
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

// Import types
import CacclCacheOptions from './CacclCacheOptions.js';
import ICacclAppEnvironment from './ICacclAppEnvironment.js';

type CacclCacheProps = {
  appEnv: ICacclAppEnvironment;
  options: CacclCacheOptions;
  vpc: ec2.Vpc;
};

export default CacclCacheProps;
