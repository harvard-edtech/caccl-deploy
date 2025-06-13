// Import base error class
import CacclDeployError from './CacclDeployError.js';

/**
 * Error for when the user cancels an operation.
 * @author Jay Luker
 */
class UserCancel extends CacclDeployError {}

export default UserCancel;
