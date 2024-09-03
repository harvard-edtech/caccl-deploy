const fs = require('fs');
const path = require('path');
const process = require('process');

const tempy = require('tempy');

module.exports = async () => {
  const tempDir = tempy.directory();

  // Set conf file path to temporary directory
  const confPath = path.join(tempDir, 'conf/');
  process.env.CACCL_DEPLOY_CONF_DIR = confPath;

  // Set NODE_ENV to test to avoid certain checks
  process.env.NODE_ENV = 'test';

  // We need to write empty config and credential files
  // to satisfy the aws-skd-mock
  const awsConfPath = path.join(tempDir, 'config');
  process.env.AWS_CONFIG_FILE = awsConfPath;
  fs.writeFileSync(awsConfPath, '');

  const awsCredPath = path.join(tempDir, 'credentials');
  process.env.AWS_SHARED_CREDENTIALS_FILE = awsCredPath;
  fs.writeFileSync(awsCredPath, '');
};
