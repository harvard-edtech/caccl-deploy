// Import base error class
import CacclDeployError from './CacclDeployError.js';

/**
 * Error indicating that a CloudFormation stack could not be found.
 * @author Jay Luker
 */
class CfnStackNotFound extends CacclDeployError {}

export default CfnStackNotFound;
