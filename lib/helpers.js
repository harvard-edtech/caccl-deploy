const fs = require('fs');
const path = require('path');

const LOOKS_LIKE_SEMVER_REGEX = new RegExp([
  '(?<Major>0|(?:[1-9]\\d*))',
  '(?:\\.(?<Minor>0|(?:[1-9]\\d*))',
  '(?:\\.(?<Patch>0|(?:[1-9]\\d*))))',
].join(''));

module.exports = {
  readJson: (filePath) => {
    return JSON.parse(
      fs.readFileSync(path.resolve(filePath), 'utf8')
    );
  },

  tagsForAws: (tags = {}) => {
    return Object.entries(tags).map(([k, v]) => {
      return { Key: k, Value: v };
    });
  },

  sleep: (ms) => {
    return new Promise((resolve) => { return setTimeout(resolve, ms); });
  },

  looksLikeSemver: (s) => {
    return LOOKS_LIKE_SEMVER_REGEX.test(s);
  },

  validSSMParamName: (name) => {
    return (/^([a-z0-9:/_-]+)$/i).test(name);
  },
};
