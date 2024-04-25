// Import Zod
import { z } from 'zod';

// Import types
import ICacclDb from './ICacclDb';
import ICacclLoadBalancer from './ICacclLoadBalancer';
import ICacclService from './ICacclService';

const CacclNotificationsProps = z.object({
  email: z.union([z.string(), z.string().array()]).optional(),
  slack: z.string().optional(),
});

// TODO: JSDoc
type CacclNotificationsProps = z.infer<typeof CacclNotificationsProps> & {
  service: ICacclService;
  loadBalancer: ICacclLoadBalancer;
  db?: ICacclDb;
};

export default CacclNotificationsProps;
