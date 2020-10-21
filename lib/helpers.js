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

  tagsForAws: (tags = {}) => {
    return Object.entries(tags).map(([k, v]) => {
      return { Key: k, Value: v };
    });
  },

  sleep: (ms) => {
    return new Promise((resolve) => { return setTimeout(resolve, ms); });
  },
};
