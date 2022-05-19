const fs = require('fs');
const path = require('path');
const semver = require('semver');

const LOOKS_LIKE_SEMVER_REGEX = new RegExp(
  [
    '(?<Major>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Minor>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Patch>0|(?:[1-9]\\d*))))',
  ].join(''),
);

module.exports = {
  readJson: (filePath) => {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  },

  readFile: (filePath) => {
    return fs.readFileSync(require.resolve(filePath), 'utf8');
  },

  tagsForAws: (tags = {}) => {
    return Object.entries(tags).map(([k, v]) => {
      return { Key: k, Value: v };
    });
  },

  sleep: (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },

  looksLikeSemver: (s) => {
    return LOOKS_LIKE_SEMVER_REGEX.test(s);
  },

  validSSMParamName: (name) => {
    return /^([a-z0-9:/_-]+)$/i.test(name);
  },

  warnAboutVersionDiff: (versionString1, versionString2) => {
    let v1;
    let v2;

    // if only one of the versions indicates a branch that's a diff
    if (
      [versionString1, versionString2].filter((v) => {
        return v.includes('branch=');
      }).length === 1
    ) {
      return true;
    }

    try {
      v1 = versionString1.match(/^package=(?<version>[^:]+)/).groups.version;
      v2 = versionString2.match(/^package=(?<version>[^:]+)/).groups.version;
    } catch (err) {
      if (err instanceof TypeError) {
        // seems like we've got bigger problems if those regexes throw an exception
        return true;
      }
      throw err;
    }
    if (v1 === v2) return false;
    // warn if either is invalid
    if (!semver.valid(v1) || !semver.valid(v2)) {
      return true;
    }
    // warn if diff is greater than a patch version
    return !semver.satisfies(v1, `${v2.slice(0, -1)}x`);
  },
};
