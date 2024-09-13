// Import helpers
import prompt from './prompt.js';

/**
 * A simple yes/no prompt to confirm a choice.
 * @author Jay Luker
 * @param message Message for the confirmation prompt
 * @param defaultsToYes Whether the default choice is yes
 * @returns whether the user picked yes or no
 */
const confirm = async (message: string, defaultsToYes?: boolean) => {
  const response = await prompt({
    initial: defaultsToYes,
    message,
    name: 'yesorno',
    type: 'confirm',
  });
  return response.yesorno;
};

export default confirm;
