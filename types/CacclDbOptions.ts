// Import Zod
import { z } from 'zod';

// Import types
import CacclDbEngine from './CacclDbEngine';

const CacclDbOptions = z.object({
  // currently either 'docdb' or 'mysql'
  engine: CacclDbEngine,
  // see the aws docs for supported types
  instanceType: z.string().optional(),
  // > 1 will get you multi-az
  instanceCount: z.number().optional(),
  // use a non-default engine version (shouldn't be necessary)
  engineVersion: z.string().optional(),
  // use a non-default parameter group family (also unnecessary)
  parameterGroupFamily: z.string().optional(),
  // only used by docdb, turns on extra profiling
  profiler: z.boolean().optional(),
  // only used by mysql, provisioning will create the named database
  databaseName: z.string().optional(),
  // removal policy controls what happens to the db if it's replaced or otherwise stops being managed by CloudFormation
  removalPolicy: z.string().optional(),
});

// TODO: JSDoc
type CacclDbOptions = z.infer<typeof CacclDbOptions>;

export default CacclDbOptions;
