import { z } from 'zod';

import type { ICacclDb } from './ICacclDb.js';
import type { ICacclLoadBalancer } from './ICacclLoadBalancer.js';
import type { ICacclService } from './ICacclService.js';

/**
 * Properties for configuring CACCL deploy notification.
 * @author Benedikt Arnarsson
 */
const CacclNotificationsProps = z.object({
  email: z.union([z.string(), z.string().array()]).optional(),
  slack: z.string().optional(),
});

/**
 * Properties for configuring CACCL deploy notification.
 * @author Benedikt Arnarsson
 */
type CacclNotificationsProps = {
  db?: ICacclDb;
  loadBalancer: ICacclLoadBalancer;
  service: ICacclService;
} & z.infer<typeof CacclNotificationsProps>;

export default CacclNotificationsProps;
