import { aws_ec2 as ec2 } from 'aws-cdk-lib';

import CacclCacheOptions from './CacclCacheOptions.js';
import ICacclAppEnvironment from './ICacclAppEnvironment.js';

/**
 * Properties to construct a AWS Elasticache instance with CACCL deploy.
 * @author Benedikt Arnarsson
 */
type CacclCacheProps = {
  appEnv: ICacclAppEnvironment;
  options: CacclCacheOptions;
  vpc: ec2.Vpc;
};

export default CacclCacheProps;
