// Import Zod
import { z } from 'zod';

const CacclScheduledTask = z.object({
  description: z.string().optional(),
  schedule: z.string(),
  command: z.string(),
});

// TODO: JSDoc
type CacclScheduledTask = z.infer<typeof CacclScheduledTask>;

export default CacclScheduledTask;
