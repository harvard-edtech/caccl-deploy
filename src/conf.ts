// Import conf
import Conf, { Options, Schema } from 'conf';

type JSONSchema = {
  ssmRootPrefix: {
    type: string;
  };
  ecrAccessRoleArn: {
    type: string;
  };
  cfnStackPrefix: {
    type: string;
  };
  productionAccounts: {
    type: string;
  };
};

const schema: Schema<JSONSchema> = {
  ssmRootPrefix: {
    type: 'string',
  },
  ecrAccessRoleArn: {
    type: 'string',
  },
  cfnStackPrefix: {
    type: 'string',
  },
  productionAccounts: {
    type: 'array',
  },
};

// const confOpts: ConstructorParameters<Conf<Schema>> = { schema };
const confOpts: Options<JSONSchema> = { schema };

// for testing allow the proc to define it's own conf dir
if (process.env.CACCL_DEPLOY_CONF_DIR !== undefined) {
  confOpts.cwd = process.env.CACCL_DEPLOY_CONF_DIR;
}

const conf = {
  configDefaults: {
    ssmRootPrefix: '/caccl-deploy',
    cfnStackPrefix: 'CacclDeploy-',
    productionAccounts: [],
  },
  setConfigDefaults: () => {
    Object.entries(conf.configDefaults).forEach(([k, v]) => {
      conf.conf.set(k, v);
    });
  },
  conf: new Conf(confOpts),
};

export default conf;
