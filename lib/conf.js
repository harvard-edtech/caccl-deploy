const Conf = require('conf');

module.exports = new Conf({
  schema: {
    ssmRootPrefix: {
      type: 'string',
      default: '/caccl-deploy',
    },
    ecrAccessRoleArn: {
      type: 'string',
    },
    cfnStackPrefix: {
      type: 'string',
      default: 'CacclDeploy-',
    },
  },
});
