import path from 'node:path';
import process from 'node:process';

import { SSMClient } from '@aws-sdk/client-ssm';
import { stub } from 'sinon';
import { temporaryDirectory } from 'tempy';

const mochaHooks = {
  beforeAll() {
    const tempDir = temporaryDirectory();

    const confPath = path.join(tempDir, '.config/');
    // process.env.CACCL_DEPLOY_CONF_DIR = confPath;
    process.env.XDG_CONFIG_HOME = confPath;

    // Set NODE_ENV to test to avoid certain checks
    process.env.NODE_ENV = 'test';
    process.env.CACCL_DEPLOY_NON_INTERACTIVE = 'true';

    // global.awsMocks = {
    //   SSM: stub(SSMClient.prototype, 'send'),
    // }

    // TODO: Setup config?
    // setConfigDefaults();
  },

  // afterEach() {
  //   Object.values(global.awsMocks).map((mock: any) => mock.reset())
  // }
};

export { mochaHooks };
