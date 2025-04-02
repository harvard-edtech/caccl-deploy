import ICacclLoadBalancer from './ICacclLoadBalancer.js';
import ICacclService from './ICacclService.js';

/**
 * Properties for CACCL deploy monitoring stack.
 * @author Benedikt Arnarsson
 */
type CacclMonitoringProps = {
  cacclLoadBalancer: ICacclLoadBalancer;
  cacclService: ICacclService;
};

export default CacclMonitoringProps;
