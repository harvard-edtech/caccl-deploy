// Import types
import ICacclLoadBalancer from './ICacclLoadBalancer.js';
import ICacclService from './ICacclService.js';

type CacclMonitoringProps = {
  cacclLoadBalancer: ICacclLoadBalancer;
  cacclService: ICacclService;
};

export default CacclMonitoringProps;
