const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const tempy = require('tempy');

describe('cli', () => {
  const cli = path.join(__dirname, '../index.js');

  test('it shows config info on first run', () => {
    const stdout = execFileSync('node', [cli, '--help'], {
      env: {
        ...process.env,
        CACCL_DEPLOY_CONF_DIR: tempy.directory(),
      },
    });
    expect(stdout.toString()).toContain('first time running');
  });

  test('it shows usage when --help arg given', () => {
    // make a mock caccl-deploy config file so we don't get the first run message
    const confPath = tempy.directory();
    fs.writeFileSync(`${confPath}/config.json`, '{ "ssmRootPrefix": "foo" }');

    const stdout = execFileSync('node', [cli, '--help'], {
      env: {
        ...process.env,
        CACCL_DEPLOY_CONF_DIR: confPath,
      },
    });
    expect(stdout.toString()).toContain('Usage: ');
  });
});
