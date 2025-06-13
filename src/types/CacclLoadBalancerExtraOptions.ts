import { z } from 'zod';

/**
 * Extra options for load balancers deployed with caccl-deploy.
 * @author Benedikt Arnarsson
 */
const CacclLoadBalancerExtraOptions = z.object({
  healthCheckPath: z.string().optional(),
  targetDeregistrationDelay: z.number().optional(),
});

/**
 * Extra options for load balancers deployed with caccl-deploy.
 * @author Benedikt Arnarsson
 */
type CacclLoadBalancerExtraOptions = z.infer<
  typeof CacclLoadBalancerExtraOptions
>;

export default CacclLoadBalancerExtraOptions;
