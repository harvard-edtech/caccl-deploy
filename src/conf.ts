// Import conf
import Conf from 'conf';

// Import types
import CacclConfSchema from './shared/types/CacclConfSchema.js';

// Construct options
const confOpts: Conf.Options<CacclConfSchema> = {
  schema: {
    cfnStackPrefix: {
      type: 'string',
    },
    ecrAccessRoleArn: {
      type: 'string',
    },
    productionAccounts: {
      type: 'array',
    },
    ssmRootPrefix: {
      type: 'string',
    },
  },
};

// for testing allow the proc to define it's own conf dir
if (process.env.CACCL_DEPLOY_CONF_DIR !== undefined) {
  confOpts.cwd = process.env.CACCL_DEPLOY_CONF_DIR;
}

// eslint-disable-next-line new-cap
const conf = new Conf.default(confOpts);

const configDefaults = {
  cfnStackPrefix: 'CacclDeploy-',
  productionAccounts: [],
  ssmRootPrefix: '/caccl-deploy',
};

const setConfigDefaults = () => {
  for (const [k, v] of Object.entries(configDefaults)) {
    conf.set(k, v);
  }
};

export { conf, configDefaults, setConfigDefaults };
