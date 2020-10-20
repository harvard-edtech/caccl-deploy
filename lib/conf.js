const Conf = require('conf');

module.exports = new Conf({
  schema: {
    ssmRootPrefix: {
      type: 'string',
      default: '/deck',
    },
    ecrAccessRoleArn: {
      type: 'string',
    },
  },
});
