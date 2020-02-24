/* eslint-disable no-console */
const fs = require('fs');

let AWS;
let awsCredentialsConfigured = false;

try {
  AWS = require('aws-sdk');
} catch (err) {
  if (err.code !== 'ENOENT' || !err.message.includes('.aws/credentials')) {
    throw err;
  }
}

module.exports = {
  configured: () => {
    return AWS.config.credentials;
  }
};
