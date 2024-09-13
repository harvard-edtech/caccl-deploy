/* eslint-disable @typescript-eslint/no-namespace */
// Import flat
import flat from 'flat';
// Import object-hash
import { sha1 } from 'object-hash';

import {
  AssumedRole,
  deleteSecrets,
  deleteSsmParameters,
  getSsmParametersByPrefix,
  putSecret,
  putSsmParameter,
  resolveSecret,
} from '../aws/index.js';
import {
  promptAppImage,
  promptCertificateArn,
  promptInfraStackName,
  promptKeyValuePairs,
} from '../configPrompts/index.js';
import logger from '../logger.js';
import AppNotFound from '../shared/errors/AppNotFound.js';
import ExistingSecretWontDelete from '../shared/errors/ExistingSecretWontDelete.js';
import readJson from '../shared/helpers/readJson.js';
import AwsTag from '../shared/types/AwsTag.js';
import { DeployConfigData } from '../types/index.js';
import create from './helpers/create.js';
import fromFlattened from './helpers/fromFlattened.js';
import wipeConfig from './helpers/wipeConfig.js';

namespace DeployConfig {
  /*------------------------------------------------------------------------*/
  /* ---------------------------- Constructors ---------------------------- */
  /*------------------------------------------------------------------------*/

  export const fromFile = (file: string): DeployConfigData => {
    const configData = readJson(file);

    // need to ignore this value from older deploy config files
    delete configData.appName;

    return create(configData);
  };

  export const fromUrl = async (url: Parameters<typeof fetch>[0]) => {
    const resp = await fetch(url);
    const configData = await resp.json();
    return create(configData);
  };

  export const fromSsmParams = async (
    appPrefix: string,
    keepSecretArns?: boolean,
  ): Promise<DeployConfigData> => {
    const ssmParams = await getSsmParametersByPrefix(appPrefix);
    if (ssmParams.length === 0) {
      throw new AppNotFound(
        `No configuration found using app prefix ${appPrefix}`,
      );
    }

    const flattened: Record<string, string> = {};
    for (const param of ssmParams) {
      if (!param.Name || !param.Value) continue;
      // trim off the prefix of the parameter name (path)
      // e.g. '/foo/bar/baz/12345' becomes 'baz/12345'
      const paramName = param.Name.split('/').slice(3).join('/');

      const value =
        keepSecretArns || !param.Value.startsWith('arn:aws:secretsmanager')
          ? param.Value
          : await resolveSecret(param.Value);

      flattened[paramName] = value;
    }

    return fromFlattened(flattened);
  };

  export const generate = async (
    assumedRole: AssumedRole,
    baseConfig: Record<PropertyKey, any> = {},
  ): Promise<DeployConfigData> => {
    const newConfig = { ...baseConfig };

    if (newConfig.infraStackName === undefined) {
      newConfig.infraStackName = await promptInfraStackName();
    }

    if (newConfig.certificateArn === undefined) {
      newConfig.certificateArn = await promptCertificateArn();
    }

    if (newConfig.appImage === undefined) {
      newConfig.appImage = await promptAppImage(assumedRole);
    }

    newConfig.tags = await promptKeyValuePairs(
      'tag',
      'foo=bar',
      newConfig.tags,
    );

    newConfig.appEnvironment = await promptKeyValuePairs(
      'env var',
      'FOOBAR=baz',
      newConfig.appEnvironment,
    );

    logger.log('\nYour new config:\n');
    logger.log(JSON.stringify(newConfig, null, 2));
    logger.log('\n');
    return create(newConfig);
  };

  /*------------------------------------------------------------------------*/
  /* ------------------------------ Helpers ------------------------------- */
  /*------------------------------------------------------------------------*/
  export const flatten = (
    deployConfig: DeployConfigData,
  ): Record<string, string> => {
    return flat(deployConfig, {
      delimiter: '/',
      safe: false,
    });
  };

  export const toString = (
    deployConfig: DeployConfigData,
    pretty?: boolean,
    flattened?: boolean,
  ) => {
    const output = flattened ? flatten(deployConfig) : deployConfig;
    return JSON.stringify(output, null, pretty ? '\t' : '');
  };

  export const toHash = (deployConfig: DeployConfigData) => {
    return sha1(deployConfig);
  };

  export const tagsForAws = (deployConfig: DeployConfigData): AwsTag[] => {
    if (
      deployConfig.tags === undefined ||
      Object.keys(deployConfig.tags).length === 0
    ) {
      return [];
    }

    return Object.entries(deployConfig.tags).map(([Key, Value]) => {
      return { Key, Value };
    });
  };

  export const syncToSsm = async (
    deployConfig: DeployConfigData,
    appPrefix: string,
    params?: Record<string, string>,
  ): Promise<void> => {
    const flattened = params === undefined ? flatten(deployConfig) : params;

    const paramEntries = Object.entries(flattened);
    const awsTags = tagsForAws(deployConfig);

    for (const [flattenedName, rawValue] of paramEntries) {
      if (!rawValue || typeof rawValue === 'object') {
        continue;
      }

      const paramName = `${appPrefix}/${flattenedName}`;

      let paramValue = rawValue.toString();
      let isSecret = false;

      if (
        flattenedName.startsWith('appEnvironment') &&
        typeof rawValue === 'string' &&
        !rawValue.startsWith('arn:aws:secretsmanager')
      ) {
        try {
          paramValue = await putSecret(
            {
              Description: 'Created and managed by caccl-deploy.',
              Name: paramName,
              SecretString: rawValue,
            },
            awsTags,
          );
        } catch (error) {
          if (error instanceof ExistingSecretWontDelete) {
            logger.log(error.message);
            logger.log('Aborting import and cleaning up.');
            await wipeConfig(appPrefix, flattened);
            return;
          }
        }

        isSecret = true;
      }

      const paramDescription = [
        'Created and managed by caccl-deploy.',
        isSecret ? 'ARN value references a secretsmanager entry' : '',
      ].join(' ');

      const paramOpts = {
        Description: paramDescription,
        Name: paramName,
        Overwrite: true,
        Type: 'String',
        Value: paramValue,
      };

      await putSsmParameter(paramOpts, awsTags);
      logger.log(`ssm parameter ${paramName} created`);
    }
  };

  // TODO: use `flatten` and `unflatten` in update and delete
  // We are assuming that the params are flattened?
  // Or make two separate delete/update functionalities?

  // FIXME: does not address flattening
  export const update = async (opts: {
    appPrefix: string;
    deployConfig: DeployConfigData;
    param: string;
    value: string;
  }): Promise<DeployConfigData> => {
    // Destructure opts
    const { appPrefix, deployConfig, param, value } = opts;

    // Create new deployConfig
    const newDeployConfig = DeployConfigData.parse({
      ...deployConfig,
      [param]: value,
    });

    // Update in SSM
    await syncToSsm(deployConfig, appPrefix, {
      [param]: value,
    });

    return newDeployConfig;
  };

  // FIXME: this does not modify the deployConfig
  export const deleteParam = async (
    deployConfig: DeployConfigData,
    appPrefix: string,
    param: string,
  ) => {
    const value = flatten(deployConfig)[param];
    if (value === undefined) {
      throw new Error(`${param} doesn't exist`);
    }

    if (value.startsWith('arn:aws:secretsmanager')) {
      await deleteSecrets([value]);
    }

    const paramPath = [appPrefix, param].join('/');
    await deleteSsmParameters([paramPath]);
  };

  export const wipeExisting = async (
    ssmPrefix: string,
    ignoreMissing = true,
  ) => {
    let existingConfig;
    try {
      existingConfig = await fromSsmParams(ssmPrefix, true);
    } catch (error) {
      if (error instanceof AppNotFound) {
        if (ignoreMissing) {
          return;
        }

        throw new AppNotFound(
          `No configuration found using prefix ${ssmPrefix}`,
        );
      } else {
        throw error;
      }
    }

    const flattened = flatten(existingConfig);

    await wipeConfig(ssmPrefix, flattened);
  };
}

export default DeployConfig;
