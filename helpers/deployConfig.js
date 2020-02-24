/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const currDir = process.env.PWD;
const deployConfigFile = path.join(currDir, 'config/deployConfig.json');

module.exports = {
  exists: () => {
    return fs.existsSync(deployConfigFile);
  },
  load: () => {

  },
  generate: () => {
    /**
     * Values to collect:
     *   - aws account id (this is not usually part of existing ~/.aws/config)
     *   - aws region (if not configured)
     *   - aws key id (if not configured)
     *   - aws secret key (if not configured)
     *   - cidr block (can we suggest one?)
     *   - infra stack name (suggest "${appName}-infra")
     */
  },
  validate: () => {

  }
}
