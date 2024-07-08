// Import base error class
import CacclDeployError from './CacclDeployError.js';

/**
 * Error indicating that the AWS profile was not found.
 * @author Jay Luker
 */
class AwsProfileNotFound extends CacclDeployError {}

export default AwsProfileNotFound;
