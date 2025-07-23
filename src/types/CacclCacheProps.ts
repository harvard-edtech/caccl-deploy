import { aws_ec2 as ec2 } from 'aws-cdk-lib';

import type { ICacclAppEnvironment } from './ICacclAppEnvironment.js';

import CacclCacheOptions from './CacclCacheOptions.js';

/**
 * Properties to construct a AWS Elasticache instance with CACCL deploy.
 * @author Benedikt Arnarsson
 */
export type CacclCacheProps = {
  appEnv: ICacclAppEnvironment;
  options: CacclCacheOptions;
  vpc: ec2.Vpc;
};
