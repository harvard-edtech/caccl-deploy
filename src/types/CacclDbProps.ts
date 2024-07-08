import { aws_ec2 as ec2 } from 'aws-cdk-lib';

import CacclDbOptions from './CacclDbOptions.js';
import ICacclAppEnvironment from './ICacclAppEnvironment.js';

type CacclDbProps = {
  // the vpc the db will be put into
  vpc: ec2.Vpc;
  options: CacclDbOptions;
  // so that we can add this construct's environment variables
  appEnv: ICacclAppEnvironment;
};

export default CacclDbProps;
