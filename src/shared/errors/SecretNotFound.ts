// Import base error class
import CacclDeployError from './CacclDeployError.js';

/**
 * Error indicating that the ECS application was not found.
 * @author Benedikt Arnarsson
 */
class SecretNotFound extends CacclDeployError {}

export default SecretNotFound;
