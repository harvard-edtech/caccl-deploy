// Import Zod
import { z } from 'zod';

// Import types
import ICacclDb from './ICacclDb.js';
import ICacclLoadBalancer from './ICacclLoadBalancer.js';
import ICacclService from './ICacclService.js';

const CacclNotificationsProps = z.object({
  email: z.union([z.string(), z.string().array()]).optional(),
  slack: z.string().optional(),
});

type CacclNotificationsProps = {
  db?: ICacclDb;
  loadBalancer: ICacclLoadBalancer;
  service: ICacclService;
} & z.infer<typeof CacclNotificationsProps>;

export default CacclNotificationsProps;
