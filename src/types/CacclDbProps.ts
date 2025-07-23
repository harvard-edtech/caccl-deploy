import { aws_ec2 as ec2 } from 'aws-cdk-lib';

import type { ICacclAppEnvironment } from './ICacclAppEnvironment.js';

import CacclDbOptions from './CacclDbOptions.js';

/**
 * CACCL deploy properties to construct an AWS RDS instance.
 * @author Benedikt Arnarsson
 */
export type CacclDbProps = {
  // so that we can add this construct's environment variables
  appEnv: ICacclAppEnvironment;
  options: CacclDbOptions;
  // the vpc the db will be put into
  vpc: ec2.Vpc;
};
