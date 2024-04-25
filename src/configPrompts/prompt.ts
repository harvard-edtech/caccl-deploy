// Import prompts
import prompts, { PromptObject } from 'prompts';

// Import shared errors
import UserCancel from '../shared/errors/UserCancel';

/**
 * Prompt wrapper, with continue/cancel errors built-in.
 * @author Jay Luker
 * @param question PromptObject to be used
 * @param continueOnCancel Whether to continue or throw an error on user-cancel
 * @returns
 */
const prompt = async (
  question: PromptObject<string>,
  continueOnCancel?: boolean,
) => {
  return prompts(question, {
    onCancel: () => {
      if (!continueOnCancel) {
        throw new UserCancel('');
      }
    },
  });
};

export default prompt;
