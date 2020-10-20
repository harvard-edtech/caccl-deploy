#!/usr/bin/env node

const result = require('./index.js')();

result.catch((err) => {
  console.log(err);
});
