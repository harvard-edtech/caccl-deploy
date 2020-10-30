const Conf = require('conf');

const _ = {
  configDefaults: {
    ssmRootPrefix: '/caccl-deploy',
    cfnStackPrefix: 'CacclDeploy-',
  },
  setConfigDefaults: () => {
    Object.entries(_.configDefaults).forEach(([k, v]) => {
      _.conf.set(k, v);
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
    },
  }),
};

module.exports = _;
