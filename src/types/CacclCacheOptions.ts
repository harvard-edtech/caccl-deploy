// Import Zod
import { z } from 'zod';

const CacclCacheOptions = z.object({
  cacheNodeType: z.string().optional(),
  engine: z.string(),
  numCacheNodes: z.number().optional(),
});

type CacclCacheOptions = z.infer<typeof CacclCacheOptions>;

export default CacclCacheOptions;
