// Import base error class
import CacclDeployError from './CacclDeployError.js';

/**
 * Error for when the user doesn't pass in a prompt choice.
 * @author Jay Luker
 */
class NoPromptChoices extends CacclDeployError {}

export default NoPromptChoices;
