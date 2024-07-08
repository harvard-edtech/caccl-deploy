// Import Zod
import { z } from 'zod';

const CacclLoadBalancerExtraOptions = z.object({
  healthCheckPath: z.string().optional(),
  targetDeregistrationDelay: z.number().optional(),
});

// TODO: JSDoc
type CacclLoadBalancerExtraOptions = z.infer<
  typeof CacclLoadBalancerExtraOptions
>;

export default CacclLoadBalancerExtraOptions;
