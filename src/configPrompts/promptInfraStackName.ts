// Import aws
import { getInfraStackList } from '../aws/index.js';
// Import shared errors
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import prompt from './prompt.js';

// Import helpers

const promptInfraStackName = async () => {
  const infraStacks = await getInfraStackList();

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
