const flat = require('flat');
const { readJson } = require('./helpers');
const { AppNotFound, ExistingSecretWontDelete } = require('./errors');
const aws = require('./aws');

const funcs = {
  fromFile(file) {
    const configData = readJson(file);

    // need to ignore this value from older deploy config files
    delete configData.appName;

    return funcs.create(configData);
  },

  async fromSsmParams(appPrefix, resolveSecrets) {
    const ssmParams = await aws.getSsmParametersByPrefix(appPrefix);

    if (!ssmParams.length) {
      throw new AppNotFound(`No configuration found using app prefix ${appPrefix}`);
    }

    const flattened = {};
    for (let i = 0; i < ssmParams.length; i += 1) {
      const param = ssmParams[i];
      // trim off the prefix of the parameter name (path)
      // e.g. '/foo/bar/baz/12345' becomes 'baz/12345'
      const paramName = param.Name
        .split('/')
        .slice(3)
        .join('/');

      const value = (resolveSecrets && param.Value.startsWith('arn:aws:secretsmanager'))
        ? await aws.resolveSecret(param.Value)
        : param.Value;

      flattened[paramName] = value;
    }
    return funcs.fromFlattened(flattened);
  },

  fromFlattened(flattenedData) {
    const unflattened = flat.unflatten(flattenedData, { delimiter: '/' });
    return funcs.create(unflattened);
  },

  async wipeExisting(ssmPrefix, ignoreMissing = true) {
    let existingConfig;
    try {
      existingConfig = await funcs.fromSsmParams(ssmPrefix);
    } catch (err) {
      if (err.name === 'AppNotFound') {
        if (ignoreMissing) {
          return;
        }
        throw new AppNotFound(`No configuration found using prefix ${ssmPrefix}`);
      }
    }

    const flattened = existingConfig.flatten();
    const paramsToDelete = Object.keys(flattened).map((k) => {
      return `${ssmPrefix}/${k}`;
    });
    const secretsToDelete = Object.values(flattened).reduce((arns, v) => {
      if (v.toString().startsWith('arn:aws:secretsmanager')) {
        arns.push(v);
      }
      return arns;
    }, []);
    await aws.deleteSsmParameters(paramsToDelete);
    await aws.deleteSecrets(secretsToDelete);
  },

  create(data) {
    const proxyFuncs = {
      everything() {
        return this;
      },

      settings() {
        const { appEnvironment, ...rest } = this;
        return rest;
      },

      nonSecretEnvVars() {
        if (this.appEnvironment === undefined) {
          return {};
        }
        const env = this.appEnvironment;
        return Object.keys(env).some((k) => {
          // values that look like secretsmanager arns are assumed to be secret
          return env[k].startsWith('arn:aws:secretsmanager');
        });
      },

      clone() {
        return funcs.create(JSON.parse(JSON.stringify(this)));
      },

      flatten() {
        return flat(this, {
          delimiter: '/',
          safe: false,
        });
      },

      toString(pretty, flattened = false) {
        const output = flattened
          ? proxyFuncs.flatten.bind(this)()
          : this;
        return JSON.stringify(output, null, pretty ? '\t' : '');
      },

      tagsForAws() {
        if (this.tags === undefined || !Object.keys(this.tags).length) {
          return [];
        }
        return Object.entries(this.tags).map(([k, v]) => {
          return { Key: k, Value: v };
        });
      },

      async update(appPrefix, param, value) {
        return proxyFuncs.syncToSsm.bind(this)(
          appPrefix,
          {
            [param]: value,
          }
        );
      },

      async syncToSsm(appPrefix, params) {
        const flattened = (params === undefined)
          ? proxyFuncs.flatten.bind(this)()
          : params;

        const paramEntries = Object.entries(flattened);
        const awsTags = proxyFuncs.tagsForAws.bind(this)();

        for (let i = 0; i < paramEntries.length; i += 1) {
          const [flattenedName, rawValue] = paramEntries[i];
          const paramName = `${appPrefix}/${flattenedName}`;

          let paramValue;
          let isSecret = false;

          if (flattenedName.startsWith('appEnvironment')
              && !rawValue.startsWith('arn:aws:secretsmanager')) {
            try {
              paramValue = await aws.putSecret({
                Name: paramName,
                SecretString: rawValue,
                Description: 'Created and managed by caccl-deploy.',
              }, awsTags);
            } catch (err) {
              if (err.name === ExistingSecretWontDelete.name) {
                console.log(err.message);
                console.log('Aborting import and cleaning up.');
                await funcs.wipeExisting(appPrefix);
                process.exit(1);
              }
            }
            isSecret = true;
          } else {
            paramValue = rawValue.toString();
          }

          const paramDescription = [
            'Created and managed by caccl-deploy.',
            (isSecret) ? 'ARN value references a secretsmanager entry' : '',
          ].join(' ');

          const paramOpts = {
            Name: paramName,
            Value: paramValue,
            Type: 'String',
            Overwrite: true,
            Description: paramDescription,
          };

          await aws.putSsmParameter(paramOpts, awsTags);
          console.log(`ssm parameter ${paramName} created`);
        }
      },
    };

    const handler = {
      has(target, property) {
        return property in target || property in proxyFuncs;
      },
      get(target, property) {
        if (typeof property === 'string' && property in proxyFuncs) {
          return proxyFuncs[property].bind(target);
        }
        return target[property];
      },
    };

    return new Proxy(data, handler);
  },
};

module.exports = funcs;
