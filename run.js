#!/usr/bin/env node

'use strict';

const result = require('./index.js')(...process.argv.slice(2));
result.catch((err) => {
  console.log(err);
});
