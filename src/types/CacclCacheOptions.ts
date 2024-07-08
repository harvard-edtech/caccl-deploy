// Import Zod
import { z } from 'zod';

const CacclCacheOptions = z.object({
  engine: z.string(),
  numCacheNodes: z.number().optional(),
  cacheNodeType: z.string().optional(),
});

// TODO: JSDoc
type CacclCacheOptions = z.infer<typeof CacclCacheOptions>;

export default CacclCacheOptions;
