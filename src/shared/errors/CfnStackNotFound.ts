// Import base error class
import CacclDeployError from './CacclDeployError';

/**
 * Error indicating that a CloudFormation stack could not be found.
 * @author Jay Luker
 */
class CfnStackNotFound extends CacclDeployError {}

export default CfnStackNotFound;
