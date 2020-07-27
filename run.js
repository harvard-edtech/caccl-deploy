#!/usr/bin/env node

'use strict';

const result = require('./index.js')();
result.catch((err) => {
  console.log(err);
});
