import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import logger
import logger from '../../logger.js';


const getCommandResult = (cmd: string) => {
  return execSync(cmd, { stdio: 'pipe', cwd: __dirname }).toString().trim();
};

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
  } catch (err) {
    // error will be capitalized depending on version of git
    if (
      err instanceof Error &&
      !err.message.toLowerCase().includes('not a git repository')
    ) {
      logger.log(String(err));
    }
  }

  if (inGitRepo) {
    // are we on a git tag?
    try {
      const gitTag = getCommandResult('git describe --exact-match --abbrev=0');
      version.push(`tag=${gitTag}`);
    } catch (err) {
      if (
        err instanceof Error &&
        !err.message.includes('no tag exactly matches')
      ) {
        logger.log(String(err));
      }
    }

    // what about the branch?
    try {
      const gitBranch = getCommandResult('git branch --show-current');
      if (gitBranch.length > 0) {
        version.unshift(`branch=${gitBranch}`);
      }
    } catch (err) {
      logger.log(String(err));
    }
  }

  return version.join(':');
};

export default generateVersion;
