import { z } from 'zod';

/**
 * Configuration for CACCL deploy scheduled tasks.
 * @author Benedikt Arnarsson
 */
const CacclScheduledTask = z.object({
  command: z.string(),
  description: z.string().optional(),
  schedule: z.string(),
});

/**
 * Configuration for CACCL deploy scheduled tasks.
 * @author Benedikt Arnarsson
 */
type CacclScheduledTask = z.infer<typeof CacclScheduledTask>;

export default CacclScheduledTask;
