const Conf = require('conf');
const tempy = require('tempy');

const confOpts = {
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

// for testing allow the proc to define it's own conf dir
if (process.env.CACCL_DEPLOY_CONF_DIR !== undefined) {
  confOpts.cwd = process.env.CACCL_DEPLOY_CONF_DIR;
}

const conf = {
  configDefaults: {
    ssmRootPrefix: '/caccl-deploy',
    cfnStackPrefix: 'CacclDeploy-',
  },
  setConfigDefaults: () => {
    Object.entries(conf.configDefaults).forEach(([k, v]) => {
      conf.conf.set(k, v);
    });
  },
  conf: new Conf(confOpts),
};

module.exports = conf;
