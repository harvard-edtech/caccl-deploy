const DeployConfig = require('../lib/deployConfig');
const tempy = require('tempy');
const fs = require('fs');
const path = require('path');

describe('deployConfig', () => {
  test('it loads a json deployconfig from an absolute path', () => {
    const tempFile = tempy.file();
    fs.writeFileSync(tempFile, '{"foo": "bar", "baz": 12345 }');
    const dc = DeployConfig.fromFile(tempFile);
    expect(dc.foo).toEqual('bar');
  });

  test('it loads a json deployconfig from a relative path', () => {
    const dc = DeployConfig.fromFile('test/resources/deployConfig-0.json');
    expect(dc.baz).toEqual(1);
  })
});
