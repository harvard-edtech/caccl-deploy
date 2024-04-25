// Import shared helpers
import prompt from './prompt';
import validSSMParamName from '../shared/helpers/validSSMParamName';

// Import helpers

const promptAppName = async () => {
  const appName = await prompt({
    type: 'text',
    name: 'value',
    message: 'Enter a name for your app',
    validate: (v) => {
      return !validSSMParamName(v)
        ? 'app name can only contain alphanumeric and/or the characters ".-_"'
        : true;
    },
  });
  return appName.value;
};

export default promptAppName;
