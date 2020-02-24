/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

// Create helpers and contstants
const currDir = process.env.PWD;
const packageFile = path.join(currDir, 'package.json');

module.exports = () => {
  if (!fs.existsSync(packageFile)) {
    return null;
  }

  // Read in current package.json fil
  try {
    return require(packageFile).name;
  } catch (err) {
    console.log('\nOops! Your package.json file seems to be corrupted. Please fix it before continuing');
    process.exit(0);
  }
};
