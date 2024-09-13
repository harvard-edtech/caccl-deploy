// Import shared helpers
import validSSMParamName from '../shared/helpers/validSSMParamName.js';
import prompt from './prompt.js';

// Import helpers

const promptAppName = async () => {
  const appName = await prompt({
    message: 'Enter a name for your app',
    name: 'value',
    type: 'text',
    validate(v) {
      return validSSMParamName(v)
        ? true
        : 'app name can only contain alphanumeric and/or the characters ".-_"';
    },
  });
  return appName.value;
};

export default promptAppName;
