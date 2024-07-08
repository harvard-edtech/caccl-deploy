// Import aws
import prompt from './prompt.js';
import { getInfraStackList } from '../aws/index.js';

// Import shared errors
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';

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

  if (!infraStackChoices.length) {
    throw new NoPromptChoices('No infrastructure stacks');
  }

  const infraStackName = await prompt({
    type: 'select',
    name: 'value',
    message: 'Select a base infrastructure stack to deploy to',
    choices: infraStackChoices,
  });
  return infraStackName.value;
};

export default promptInfraStackName;
