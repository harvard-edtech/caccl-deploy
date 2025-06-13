// Import base error class
import CacclDeployError from './CacclDeployError.js';

/**
 * Error deleting an existing SSM secret.
 * @author Jay Luker
 */
class ExistingSecretWontDelete extends CacclDeployError {}

export default ExistingSecretWontDelete;
