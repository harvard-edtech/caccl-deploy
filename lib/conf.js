const Conf = require('conf');

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
  conf: new Conf({
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
  }),
};

module.exports = conf;
