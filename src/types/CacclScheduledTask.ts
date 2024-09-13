// Import Zod
import { z } from 'zod';

const CacclScheduledTask = z.object({
  command: z.string(),
  description: z.string().optional(),
  schedule: z.string(),
});

type CacclScheduledTask = z.infer<typeof CacclScheduledTask>;

export default CacclScheduledTask;
