import type { ICacclLoadBalancer } from './ICacclLoadBalancer.js';
import type { ICacclService } from './ICacclService.js';

/**
 * Properties for CACCL deploy monitoring stack.
 * @author Benedikt Arnarsson
 */
export type CacclMonitoringProps = {
  cacclLoadBalancer: ICacclLoadBalancer;
  cacclService: ICacclService;
};
