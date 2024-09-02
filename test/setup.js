const process = require('process');

const tempy = require('tempy');

module.exports = async () => {
  const confPath = tempy.directory();

  process.env.CACCL_DEPLOY_CONF_DIR = confPath;
};
