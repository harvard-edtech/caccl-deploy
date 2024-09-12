// Import NodeJS builtins
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Import AWS SDK mock
import AWSMock from 'aws-sdk-mock';

// Import tempy
import { temporaryDirectory } from 'tempy';

// Import conf
import { setConfigDefaults } from '../src/conf.js';

const mochaHooks = {
  beforeAll() {
    const tempDir = temporaryDirectory();

    // Set conf file path to temporary directory
    const confPath = path.join(tempDir, 'conf/');
    process.env.CACCL_DEPLOY_CONF_DIR = confPath;

    // Set NODE_ENV to test to avoid certain checks
    process.env.NODE_ENV = 'test';

    // We need to write empty config and credential files
    // to satisfy the aws-skd-mock
    const awsConfPath = path.join(tempDir, 'config');
    process.env.AWS_CONFIG_FILE = awsConfPath;
    fs.writeFileSync(awsConfPath, '[default]\nregion=us-east-1');

    const awsCredPath = path.join(tempDir, 'credentials');
    process.env.AWS_SHARED_CREDENTIALS_FILE = awsCredPath;
    fs.writeFileSync(awsCredPath, '[default]\naws_access_key_id=fakeaccesskeyid\naws_secret_access_key=fakeaccesskey');

    // Setup config
    setConfigDefaults();
  },

  afterEach() {
    // @ts-ignore
    AWSMock.restore();
  }
};

export {
  mochaHooks,
};