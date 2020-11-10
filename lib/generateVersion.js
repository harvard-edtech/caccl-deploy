const { execSync, spawnSync, spawn } = require('child_process');
const packageVersion = require('../package.json').version;

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
    const isInsideWorkTree = execSync(
      'git rev-parse --is-inside-work-tree',
      { stdio: 'pipe' }
    ).toString()
      .trim();
    inGitRepo = isInsideWorkTree === 'true';
  } catch (err) {
    if (!err.message.includes('not a git repository')) {
      console.log(err);
    }
  }

  if (inGitRepo) {
    // are we on a git tag?
    try {
      const gitTag = execSync(
        'git describe --exact-match --abbrev=0',
        { stdio: 'pipe' }
      ).toString()
        .trim();
      version.push(`tag=${gitTag}`);
    } catch (err) {
      if (!err.message.includes('no tag exactly matches')) {
        console.log(err);
      }

      // ok we're not on a tag but are their local changes?
      const diffIndex = spawnSync(
        'git', ['diff-index', 'HEAD', '--quiet']
      );
      let commitSha;
      if (diffIndex.status === 1) {
        commitSha = '(local changes)';
      } else {
        commitSha = execSync(
          'git rev-parse --short HEAD',
          { stdio: 'pipe' }
        ).toString()
          .trim();
      }
      version.push(`sha=${commitSha}`);
    }

    // what about the branch?
    try {
      const gitBranch = execSync(
        'git branch --show-current',
        { stdio: 'pipe' }
      ).toString()
        .trim();
      if (gitBranch.length > 0) {
        version.push(`branch=${gitBranch}`);
      }
    } catch (err) {
      console.log(err);
    }
  }

  return version.join(':');
};
