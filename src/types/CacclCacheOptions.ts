import { z } from 'zod';

/**
 * CACCL deploy ElastiCache options.
 * @author Benedikt Arnarsson
 */
const CacclCacheOptions = z.object({
  cacheNodeType: z.string().optional(),
  engine: z.enum(['memcached', 'redis', 'valkey']),
  numCacheNodes: z.coerce.number().optional(),
});

type CacclCacheOptions = z.infer<typeof CacclCacheOptions>;

export default CacclCacheOptions;
