import { getInfraStackList } from '../aws/index.js';
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import prompt from './prompt.js';

/**
 * Prompt the user for a specific infrastructure stack name from a set of valid CF stacks in the account.
 * @param {string} [profile='default'] the AWS profile.
 * @returns {Promise<string>} the infrastructure stack name.
 */
const promptInfraStackName = async (profile = 'default'): Promise<string> => {
  const infraStacks = await getInfraStackList(profile);

  if (infraStacks.length === 1) {
    return infraStacks[0];
  }

  const infraStackChoices = infraStacks.map((value) => {
    return {
      title: value,
      value,
    };
  });

  if (infraStackChoices.length === 0) {
    throw new NoPromptChoices('No infrastructure stacks');
  }

  const infraStackName = await prompt({
    choices: infraStackChoices,
    message: 'Select a base infrastructure stack to deploy to',
    name: 'value',
    type: 'select',
  });
  return infraStackName.value;
};

export default promptInfraStackName;
