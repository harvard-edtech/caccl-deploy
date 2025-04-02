import prompts, { PromptObject } from 'prompts';

import UserCancel from '../shared/errors/UserCancel.js';

/**
 * Prompt wrapper, with continue/cancel errors built-in.
 * @author Jay Luker
 * @param {PromptObject<string>} question PromptObject to be used
 * @param {boolean} continueOnCancel Whether to continue or throw an error on user-cancel
 * @returns {Promise<void>} promise to await.
 */
const prompt = async (
  question: PromptObject<string>,
  continueOnCancel?: boolean,
) => {
  return prompts(question, {
    onCancel() {
      if (!continueOnCancel) {
        throw new UserCancel('');
      }
    },
  });
};

export default prompt;
