// Import base error class
import CacclDeployError from './CacclDeployError';

/**
 * Error indicating that the ECS application was not found.
 * @author Jay Luker
 */
class AppNotFound extends CacclDeployError {}

export default AppNotFound;
