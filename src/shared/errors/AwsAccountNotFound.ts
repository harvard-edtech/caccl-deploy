// Import base error class
import CacclDeployError from './CacclDeployError';

/**
 * Error indicating that the AWS account was not found.
 * @author Benedikt Arnarsson
 */
class AwsAccountNotFound extends CacclDeployError {}

export default AwsAccountNotFound;
