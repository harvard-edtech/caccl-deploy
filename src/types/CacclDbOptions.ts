import { z } from 'zod';

import CacclDbEngine from './CacclDbEngine.js';

/**
 * CACCL deploy RDS options.
 * @author Benedikt Arnarsson
 */
const CacclDbOptions = z.object({
  // only used by mysql, provisioning will create the named database
  databaseName: z.string().optional(),
  // currently either 'docdb' or 'mysql'
  engine: CacclDbEngine,
  // use a non-default engine version (shouldn't be necessary)
  engineVersion: z.string().optional(),
  // > 1 will get you multi-az
  instanceCount: z.coerce.number().optional(),
  // see the aws docs for supported types
  instanceType: z.string().optional(),
  // use a non-default parameter group family (also unnecessary)
  parameterGroupFamily: z.string().optional(),
  // only used by docdb, turns on extra profiling
  profiler: z.boolean().optional(),
  // removal policy controls what happens to the db if it's replaced or otherwise stops being managed by CloudFormation
  removalPolicy: z.string().optional(),
});

type CacclDbOptions = z.infer<typeof CacclDbOptions>;

export default CacclDbOptions;
