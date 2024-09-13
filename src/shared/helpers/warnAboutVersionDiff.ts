// Import semver
import semver from 'semver';

/**
 * Indicate whether we should warn about mis-matched versions.
 * Assumes strings in semver format.
 * @author Jay Luker
 * @param versionString1 first semver that we are comparing.
 * @param versionString2 second semver that we are comparing.
 * @returns whether we should warn about differing versions.
 */
const warnAboutVersionDiff = (
  versionString1: string,
  versionString2: string,
): boolean => {
  // if only one of the versions indicates a branch that's a diff
  if (
    [versionString1, versionString2].filter((v) => {
      return v.includes('branch=');
    }).length === 1
  ) {
    return true;
  }

  const v1 = versionString1.match(/^package=(?<version>[^:]+)/)?.groups
    ?.version;
  const v2 = versionString2.match(/^package=(?<version>[^:]+)/)?.groups
    ?.version;

  // Warn if either does not match the regex
  if (!v1 || !v2) return true;

  // Don't warn if they are equal
  if (v1 === v2) return false;

  // Warn if either is invalid
  if (!semver.valid(v1) || !semver.valid(v2)) {
    return true;
  }

  // warn if diff is greater than a patch version
  return !semver.satisfies(v1, `${v2.slice(0, -1)}x`);
};

export default warnAboutVersionDiff;
