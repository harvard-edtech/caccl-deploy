const fs = require('fs');
const prompts = require('prompts');

module.exports = {
  readJson: (path) => {
    return JSON.parse(
      fs.readFileSync(require.resolve(path), 'utf8')
    );
  },

  confirm: async (message, initial = true) => {
    const response = await prompts({
      type: 'confirm',
      name: 'yesorno',
      initial,
      message,
    });
    return response.yesorno;
  },

  PROMPTS_OPTS: {
    appName: {
      message: 'Enter a name for your app',
      validate: (v) => {
        return !(/^[a-z0-9.\-_]+$/i).test(v)
          ? 'app name can only contain alphanumeric and/or the characters ".-_"'
          : true;
      },
    },
    infra: {
      message: 'Enter the base infrastructure CloudFormation stack name',
    },
  },

  prompt: async (promptOpts) => {
    const response = await prompts({
      type: 'text',
      name: 'value',
      ...promptOpts,
    });
    return response.value;
  },

  tagsForAws: (tags = {}) => {
    return Object.entries(tags).map(([k, v]) => {
      return { Key: k, Value: v };
    });
  },

  sleep: (ms) => {
    return new Promise((resolve) => { return setTimeout(resolve, ms); });
  },
};
