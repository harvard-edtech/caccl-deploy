import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getCommandResult = (cmd: string) => {
  return execSync(cmd, { cwd: __dirname, stdio: 'pipe' }).toString().trim();
};

/**
 * Generate the CLI version from the package.json.
 * @author Benedikt Arnarsson
 * @returns {string} the semver compatible version of the caccl-deploy CLI.
 */
const generateVersion = () => {
  // Get version from package.json
  const packageVersion = '1.0.0';

  // always use an env var if defined
  if (process.env.CACCL_DEPLOY_VERSION !== undefined) {
    return process.env.CACCL_DEPLOY_VERSION;
  }

  // otherwise use the package.json version
  const version = [`package=${packageVersion}`];

  // are we in a git repo?
  let inGitRepo = false;
  try {
    const gitLsThisFile = getCommandResult(`git ls-files ${__filename}`);
    inGitRepo = gitLsThisFile !== '';
  } catch (error) {
    // error will be capitalized depending on version of git
    if (
      error instanceof Error &&
      !error.message.toLowerCase().includes('not a git repository')
    ) {
      logger.log(String(error));
    }
  }

  if (inGitRepo) {
    // are we on a git tag?
    try {
      const gitTag = getCommandResult('git describe --exact-match --abbrev=0');
      version.push(`tag=${gitTag}`);
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('no tag exactly matches')
      ) {
        logger.log(String(error));
      }
    }

    // what about the branch?
    try {
      const gitBranch = getCommandResult('git branch --show-current');
      if (gitBranch.length > 0) {
        version.unshift(`branch=${gitBranch}`);
      }
    } catch (error) {
      logger.log(String(error));
    }
  }

  return version.join(':');
};

export default generateVersion;
