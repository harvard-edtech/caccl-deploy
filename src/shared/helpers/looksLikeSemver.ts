const LOOKS_LIKE_SEMVER_REGEX = new RegExp(
  [
    '(?<Major>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Minor>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Patch>0|(?:[1-9]\\d*))))',
  ].join(''),
);

/**
 * Check whether a string looks like a 'semantic versioning' number.
 * See https://semver.org for info.
 * @author Jay Luker
 * @param {string} str string that may or may not be semver.
 * @returns {boolean} Whether the string matches a semver pattern.
 */
const looksLikeSemver = (str: string): boolean => {
  return LOOKS_LIKE_SEMVER_REGEX.test(str);
};

export default looksLikeSemver;
