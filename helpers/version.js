const { execSync } = require('child_process');

module.exports = () => {
  // always use an env var if defined
  if (process.env.CACCL_DEPLOY_VERSION != undefined) {
    return process.env.CACCL_DEPLOY_VERSION;
  }

  // otherwise use the package.json version
  const version = [require('../package.json').version];

  // are we on a git tag?
  try {
    const gitTag = execSync(
      'git describe --tags --abbrev=0',
      { stdio: 'pipe' },
    ).toString().trim();
    version.push(`tag=${gitTag}`);
  } catch (err) {
    if (!err.message.includes('No tags can describe')) {
      console.log(err);
    }
  }

  // what about the branch?
  try {
    const gitBranch = execSync(
      'git branch --show-current',
      { stdio: 'pipe' },
    ).toString().trim();
    if (gitBranch.length > 0) {
      version.push(`branch=${gitBranch}`);
    }
  } catch (err) {
    console.log(err);
  }

  return version.join(':');
};
