/* eslint-disable @typescript-eslint/no-namespace */
import flat from 'flat';
import { sha1 } from 'object-hash';

import {
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
import { type AwsTag } from '../shared/types/AwsTag.js';
import { type CacclDeployContext } from '../types/CacclDeployContext.js';
import { DeployConfigData } from '../types/index.js';
import create from './helpers/create.js';
import fromFlattened from './helpers/fromFlattened.js';
import wipeConfig from './helpers/wipeConfig.js';

namespace DeployConfig {
  /*------------------------------------------------------------------------*/
  /* ---------------------------- Constructors ---------------------------- */
  /*------------------------------------------------------------------------*/

  /**
   * Read a deploy configuration from a JSON file.
   * @author Jay Luker, Benedikt Arnarsson
   * @param {string} file .json file to read from.
   * @returns {DeployConfigData} the deploy configuration data parsed from the JSON file.
   */
  export const fromFile = (file: string): DeployConfigData => {
    const configData = readJson(file);

    // need to ignore this value from older deploy config files
    delete configData.appName;

    return create(configData);
  };

  /**
   * Read a deploy configuration from a GET API response body.
   * Reads the body as a JSON.
   * @author Jay Luker, Benedikt Arnarsson
   * @param {string} url the URL for the JSON data.
   * @returns {DeployConfigData} deploy configuration parse from the JSON returned from the GET.
   */
  export const fromUrl = async (
    url: Parameters<typeof fetch>[0],
  ): Promise<DeployConfigData> => {
    const resp = await fetch(url);
    const configData = await resp.json();
    return create(configData);
  };

  /**
   * Read a deploy configuration from AWS SSM.
   * @param {string} appPrefix the SSM prefix for the application.
   * @param {boolean} [keepSecretArns] whether to keep secrets as ARNs rather than values.
   * @param {string} [profile='default'] AWS profile.
   * @returns {Promise<DeployConfigData>} the deploy configuration parsed from AWS SSM.
   */
  export const fromSsmParams = async (
    appPrefix: string,
    keepSecretArns?: boolean,
    profile = 'default',
  ): Promise<DeployConfigData> => {
    const ssmParams = await getSsmParametersByPrefix(appPrefix, profile);
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
          : await resolveSecret(param.Value, profile);

      flattened[paramName] = value;
    }

    return fromFlattened(flattened);
  };

  /**
   * Generate a deploy configuration from the CACCL deploy context and a base configuration.
   * Will prompt the user if values are unavailable.
   * @author Jay Luker, Benedikt Arnarsson
   * @param {CacclDeployContext} context CACCL deploy context
   * @param {Partial<DeployConfigData>} [baseConfig={}] the base configuration - can be empty
   * @returns {Promise<DeployConfigData>} the fully formed deploy configuration
   */
  export const generate = async (
    context: CacclDeployContext,
    baseConfig: Partial<DeployConfigData> = {},
  ): Promise<DeployConfigData> => {
    const newConfig = { ...baseConfig };

    if (newConfig.infraStackName === undefined) {
      newConfig.infraStackName = await promptInfraStackName(context.profile);
    }

    if (newConfig.certificateArn === undefined) {
      newConfig.certificateArn = await promptCertificateArn(context.profile);
    }

    if (newConfig.appImage === undefined) {
      newConfig.appImage = await promptAppImage(context);
    }

    if (!context.yes) {
      newConfig.tags = await promptKeyValuePairs(
        'tag',
        'foo=bar',
        newConfig.tags,
      );
    }

    if (!context.yes) {
      newConfig.appEnvironment = await promptKeyValuePairs(
        'env var',
        'FOOBAR=baz',
        newConfig.appEnvironment,
      );
    }

    logger.log('\nYour new config:\n');
    logger.log(JSON.stringify(newConfig, null, 2));
    logger.log('\n');
    return create(newConfig);
  };

  /*------------------------------------------------------------------------*/
  /* ------------------------------ Helpers ------------------------------- */
  /*------------------------------------------------------------------------*/
  /**
   * Create a flattened deploy configuration
   * @author Jay Luker, Benedikt Arnarsson
   * @param {DeployConfigData} deployConfig unflattened deploy configuration
   * @returns {Record<string, string>} flattened deploy configuration
   */
  export const flatten = (
    deployConfig: DeployConfigData,
  ): Record<string, string> => {
    return flat(deployConfig, {
      delimiter: '/',
      safe: false,
    });
  };

  /**
   * Create a string of a given deploy configuration
   * @author Jay Luker
   * @param {DeployConfigData} deployConfig the deploy configuration to stringify.
   * @param {boolean} [pretty] whether to pretty print it or not (with spaces)
   * @param {boolean} [flattened] whether to flatten it or not
   * @returns {string} the string representing the deploy configuration
   */
  export const toString = (
    deployConfig: DeployConfigData,
    pretty?: boolean,
    flattened?: boolean,
  ) => {
    const output = flattened ? flatten(deployConfig) : deployConfig;
    return JSON.stringify(output, null, pretty ? '\t' : '');
  };

  /**
   * Create the hash associated with the deploy configuration.
   * @author Jay Luker
   * @param {DeployConfigData} deployConfig the deploy configuration
   * @returns {string} the hash associated with the deploy configuration
   */
  export const toHash = (deployConfig: DeployConfigData) => {
    return sha1(deployConfig);
  };

  /**
   * Return the list of tags for the deploy configuration.
   * @author Jay Luker
   * @param {DeployConfigData} deployConfig the deploy configuration
   * @returns {AwsTag[]} the AWS tags associated with the deploy configuration.
   */
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

  /**
   * Sync the local deploy configuration and remote SSM parameters + SM secrets.
   * @author Jay Luker, Benedikt Arnarsson
   * @param opts sync to SSM options
   * @param {string} opts.appPrefix the application SSM + app name prefix
   * @param {DeployConfigData} opts.deployConfig the deploy configuration that we are syncing
   * @param {Record<string, string>} [opts.params] specified FLATTENED parameters to synchronize, will override opts.deployConfig.
   * @param {string} [opts.profile='default'] the AWS profile
   * @returns {Promise<void>} promise to await
   */
  export const syncToSsm = async (opts: {
    appPrefix: string;
    deployConfig: DeployConfigData;
    params?: Record<string, string>;
    profile?: string;
  }): Promise<void> => {
    const { appPrefix, deployConfig, params, profile = 'default' } = opts;
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
          paramValue = await putSecret({
            profile,
            secretOpts: {
              Description: 'Created and managed by caccl-deploy.',
              Name: paramName,
              SecretString: rawValue,
            },
            tags: awsTags,
          });
        } catch (error) {
          if (error instanceof ExistingSecretWontDelete) {
            logger.log(error.message);
            logger.log('Aborting import and cleaning up.');
            await wipeConfig(appPrefix, flattened, profile);
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
        Type: 'String' as const,
        Value: paramValue,
      };

      await putSsmParameter(paramOpts, awsTags, profile);
      logger.log(`ssm parameter ${paramName} created`);
    }
  };

  // TODO: use `flatten` and `unflatten` in update and delete
  // We are assuming that the params are flattened?
  // Or make two separate delete/update functionalities?

  // FIXME: does not address flattening
  /**
   * Update specified parameter in the deploy config, locally and remotely on AWS.
   * @author Jay Luker, Benedikt Arnarsson
   * @param opts update options
   * @param {string} opts.appPrefix the application SSM + app name prefix
   * @param {DeployConfigData} opts.deployConfig the deploy configuration that we are updating
   * @param {string} opts.param key for parameter to update
   * @param {string} [opts.profile='default'] the AWS profile
   * @param {string} opts.value value to update the specified param to
   * @returns {Promise<DeployConfigData>} the updated deploy configuration
   */
  export const update = async (opts: {
    appPrefix: string;
    deployConfig: DeployConfigData;
    param: string;
    profile?: string;
    value: string;
  }): Promise<DeployConfigData> => {
    // Destructure opts
    const { appPrefix, deployConfig, param, profile = 'default', value } = opts;

    // Create new deployConfig
    const newDeployConfig = DeployConfigData.parse({
      ...deployConfig,
      [param]: value,
    });

    // Update in SSM
    await syncToSsm({
      appPrefix,
      deployConfig,
      params: {
        [param]: value,
      },
      profile,
    });

    return newDeployConfig;
  };

  // FIXME: this does not modify the deployConfig, only does so on AWS SSM/SM
  /**
   * Delete a specified parameter from the deploy configuration
   * @author Jay Luker, Benedikt Arnarsson
   * @param opts delete parameter options
   * @param {string} opts.appPrefix the application SSM + app name prefix
   * @param {DeployConfigData} opts.deployConfig the deploy configuration that we are updating
   * @param {string} opts.param key for parameter to delete
   * @param {string} [opts.profile='default'] the AWS profile
   * @returns {Promise<void>} promise to await
   */
  export const deleteParam = async (opts: {
    appPrefix: string;
    deployConfig: DeployConfigData;
    param: string;
    profile?: string;
  }): Promise<void> => {
    const { appPrefix, deployConfig, param, profile = 'default' } = opts;
    const value = flatten(deployConfig)[param];
    if (value === undefined) {
      throw new Error(`${param} doesn't exist`);
    }

    if (value.startsWith('arn:aws:secretsmanager')) {
      await deleteSecrets([value], profile);
    }

    const paramPath = [appPrefix, param].join('/');
    await deleteSsmParameters([paramPath], profile);
  };

  /**
   * Delete all deploy configuration data (parameters/secrets) associated with a prefix.
   * @author Jay Luker, Benedikt Arnarsson
   * @param {string} ssmPrefix the prefix associated with the deploy configuration.
   * @param {boolean} [ignoreMissing=true] whether to ignore if the SSM prefix is found. Will otherwise throw an error.
   * @param {string} [profile='default'] the AWS profile
   * @returns {Promise<void>} promise to await
   */
  export const wipeExisting = async (
    ssmPrefix: string,
    ignoreMissing = true,
    profile = 'default',
  ) => {
    let existingConfig;
    try {
      existingConfig = await fromSsmParams(ssmPrefix, true, profile);
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

    await wipeConfig(ssmPrefix, flattened, profile);
  };
}

export default DeployConfig;
