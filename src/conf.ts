// Import conf
import Conf from 'conf';

// Import types
import CacclConfSchema from './shared/types/CacclConfSchema.js';

// Construct options
const confOpts: Conf.Options<CacclConfSchema> = {
  schema: {
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
  },
};

// for testing allow the proc to define it's own conf dir
if (process.env.CACCL_DEPLOY_CONF_DIR !== undefined) {
  confOpts.cwd = process.env.CACCL_DEPLOY_CONF_DIR;
}

const conf = new Conf.default(confOpts);

const configDefaults = {
  ssmRootPrefix: '/caccl-deploy',
  cfnStackPrefix: 'CacclDeploy-',
  productionAccounts: [],
};

const setConfigDefaults = () => {
  Object.entries(configDefaults).forEach(([k, v]) => {
    conf.set(k, v);
  });
};

export { conf, configDefaults, setConfigDefaults };
