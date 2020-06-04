#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

// Prep command executor
const exec = (command, options = {}) => {
  options.stdio = 'inherit';
  console.log(command);
  return execSync(command, options);
};

const print = require('./helpers/print');

let deployConfigPath = process.env.CACCL_DEPLOY_CONFIG;
if (deployConfigPath === undefined) {
  deployConfigPath = path.join(process.env.PWD, 'config/deployConfig.js');
}
const config = require(deployConfigPath);
console.log(config);
exec('printenv');

// if (!argv._.length) {
//   // output secrets + ARNs
// } else if (argv._[0] === 'add') {
//   if (argv._.length !== 2) {
//     throw new Error('Usage: ')
//   }
//   const varName = argv._[1] || throw new Error('Missing var name');
// }
