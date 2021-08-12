const { execSync, spawnSync } = require('child_process');

const packageVersion = require('../package.json').version;

const getCommandResult = (cmd) => {
  return execSync(cmd, { stdio: 'pipe', cwd: __dirname, })
    .toString()
    .trim();
};

module.exports = () => {
  // always use an env var if defined
  if (process.env.CACCL_DEPLOY_VERSION !== undefined) {
    return process.env.CACCL_DEPLOY_VERSION;
  }

  // otherwise use the package.json version
  const version = [
    `package=${packageVersion}`,
  ];

  // are we in a git repo?
  let inGitRepo = false;
  try {
    const gitLsThisFile = getCommandResult(
      `git ls-files ${__filename}`
    );
    inGitRepo = gitLsThisFile !== '';
  } catch (err) {
    // error will be captialized depending on version of git
    if (!err.message.toLowerCase().includes('not a git repository')) {
      console.log(err);
    }
  }

  if (inGitRepo) {
    // are we on a git tag?
    try {
      const gitTag = getCommandResult(
        'git describe --exact-match --abbrev=0'
      );
      version.push(`tag=${gitTag}`);
    } catch (err) {
      if (!err.message.includes('no tag exactly matches')) {
        console.log(err);
      }
    }

    // what about the branch?
    try {
      const gitBranch = getCommandResult(
        'git branch --show-current'
      );
      if (gitBranch.length > 0) {
        version.unshift(`branch=${gitBranch}`);
      }
    } catch (err) {
      console.log(err);
    }
  }

  return version.join(':');
};
