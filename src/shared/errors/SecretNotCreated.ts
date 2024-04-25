// Import base error class
import CacclDeployError from './CacclDeployError';

/**
 * Error indicating that the ECS application was not found.
 * @author Benedikt Arnarsson
 */
class SecretNotCreated extends CacclDeployError {}

export default SecretNotCreated;
