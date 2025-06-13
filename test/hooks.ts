import path from 'node:path';
import process from 'node:process';

import { ACMClient } from '@aws-sdk/client-acm';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { EC2InstanceConnectClient } from '@aws-sdk/client-ec2-instance-connect';
import { ECRClient } from '@aws-sdk/client-ecr';
import { ECSClient } from '@aws-sdk/client-ecs';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SSMClient } from '@aws-sdk/client-ssm';
import { STSClient } from '@aws-sdk/client-sts';

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

    // Stubbing all client `sends` so that we don't make external calls
    global.awsMocks = {
      ACM: stub(ACMClient.prototype, 'send'),
      CloudFormation: stub(CloudFormationClient.prototype, 'send'),
      EC2InstanceConnect: stub(EC2InstanceConnectClient.prototype, 'send'),
      ECR: stub(ECRClient.prototype, 'send'),
      ECS: stub(ECSClient.prototype, 'send'),
      SecretsManager: stub(SecretsManagerClient.prototype, 'send'),
      SSM: stub(SSMClient.prototype, 'send'),
      STS: stub(STSClient.prototype, 'send'),
    };

    // TODO: Setup config?
  },

  // afterEach() {
  //   Object.values(global.awsMocks).map((mock: any) => mock.reset())
  // }
};

export { mochaHooks };
