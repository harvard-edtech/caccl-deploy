/* eslint-disable valid-jsdoc */
/* eslint-disable import/prefer-default-export */
/**
 * Base oclif Command to setup 'global' flags and context.
 * @author Benedikt Arnarsson
 */
import { Command, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import envPaths from 'env-paths';
import figlet from 'figlet';
import fs from 'node:fs';
import path from 'node:path';

import { confirm } from './configPrompts/index.js';
import DeployConfig from './deployConfig/index.js';
import logger from './logger.js';
import AppNotFound from './shared/errors/AppNotFound.js';
import CacclDeployConfig from './types/CacclDeployConfig.js';
import CacclDeployContext from './types/CacclDeployContext.js';
import { DeployConfigData } from './types/index.js';

// Types
type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  // eslint-disable-next-line no-use-before-define
  (typeof BaseCommand)['baseFlags'] & T['flags']
>;
type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

/**
 * Base caccl-deploy Command, defining common flags, capabilities, and initialization logic.
 * @author Benedikt Arnarsson
 */
export abstract class BaseCommand<T extends typeof Command> extends Command {
  // define flags that can be inherited by any command that extends BaseCommand
  static baseFlags = {
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      hidden: true,
    }),
    'cfn-stack-prefix': Flags.string({
      description: 'cloudformation stack name prefix, e.g. "CacclDeploy-',
      helpGroup: 'GLOBAL',
      required: true,
    }),
    'config': Flags.string({
      char: 'c',
      description: 'Path to a file containing CACCL Deploy CLI config.',
      env: 'CACCL_DEPLOY_CONFIG',
      summary: 'CACCL Deploy config file.',
    }),
    'ecr-access-role-arn': Flags.string({
      description: 'IAM role ARN for cross account ECR repo access',
      helpGroup: 'GLOBAL',
    }),
    'profile': Flags.string({
      default: 'default',
      description: 'activate a specific aws config/credential profile',
      helpGroup: 'GLOBAL',
    }),
    'ssm-root-prefix': Flags.string({
      description: 'The root prefix for ssm parameter store entries',
      helpGroup: 'GLOBAL',
    }),
    'yes': Flags.boolean({
      char: 'y',
      default: false,
      description:
        'non-interactive, yes to everything, overwrite existing, etc',
      env: 'CACCL_DEPLOY_NON_INTERACTIVE',
      helpGroup: 'GLOBAL',
    }),
  };

  static description = 'A cli tool for managing ECS/Fargate app deployments';

  protected args!: Args<T>;
  protected flags!: Flags<T>;

  // Contains the config merged with the flags
  protected context!: CacclDeployContext;

  /**
   * Shared init method for all commands,
   *    - set the logger
   *    - pull in common flags
   *    - find config file and creates/reads it
   *    - merges config and flags into context
   * @author Benedikt Arnarsson
   */
  public async init(): Promise<void> {
    // Set the logger
    logger.setLogger(this.log, this.logToStderr);

    // Parse args and flags
    await super.init();
    const { args, flags } = await this.parse({
      args: this.ctor.args,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      flags: this.ctor.flags,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;

    // Get config from the file
    const config = await this.getConfigFromFile();

    // Merging config and flags into context:
    this.context = {
      ...config,
      cfnStackPrefix: this.flags['cfn-stack-prefix'] ?? config.cfnStackPrefix,
      ecrAccessRoleArn:
        this.flags['ecr-access-role-arn'] ?? config.ecrAccessRoleArn,
      profile: this.flags.profile,
      ssmRootPrefix: this.flags['ssm-root-prefix'] ?? config.ssmRootPrefix,
      yes: this.flags.yes,
    };
  }

  /**
   * Exit the CLI app with an error message and an exit code of 1.
   * @author Benedikt Arnarsson
   * @param {string} msg error message to log before exiting.
   */
  public exitWithError = (msg?: string) => {
    this.bye(msg, 1);
  };

  /**
   * Exit the CLI app with a message and an exit code of 0.
   * @author Benedikt Arnarsson
   * @param {string} msg message to log before exiting.
   */
  public exitWithSuccess = (msg?: string) => {
    this.bye(msg);
  };

  /**
   * Catches any errors that bubble all the way up. Not implemented so far.
   * @author Benedikt Arnarsson
   * @param {{ exitCode?: number } & Error} err the caught error information.
   * @returns {Promise<any>}
   */
  protected async catch(err: { exitCode?: number } & Error): Promise<any> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err);
  }

  /**
   * Function that will run at the end of the command, whether or not there was an error.
   * Nothing implemented so far.
   * @author Benedikt Arnarsson
   * @param {Error | undefined} _ error information, if there was an error during command execution.
   * @returns {Promise<any>}
   */
  protected async finally(_: Error | undefined): Promise<any> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_);
  }

  /**
   * Convenience method for getting the combined root prefix plus app name
   * used for the SSM Parameter Store parameter names.
   * @author Jay Luker
   * @param {string} appName app name, defaults to flag value.
   * @returns {string} the full SSM prefix for the specified app.
   */
  public getAppPrefix(appName?: string) {
    // Destructure flags
    const { app, 'ssm-root-prefix': ssmRootPrefix } = this.flags;

    if (
      ssmRootPrefix === undefined ||
      (app === undefined && appName === undefined)
    ) {
      throw new Error('Attempted to make an ssm prefix with undefined values');
    }

    return `${ssmRootPrefix}/${appName || app}`;
  }

  /**
   * Convenience method for getting the name of the app's CloudFormation stack
   * @author Jay Luker
   * @param {string} appName specific app name, defaults to flag value
   * @returns {string} app CloudFormation stack name
   */
  public getCfnStackName(appName?: string) {
    // Destructure flags
    const { app, 'cfn-stack-prefix': cfnStackPrefix } = this.flags;

    if (
      cfnStackPrefix === undefined ||
      (app === undefined && appName === undefined)
    ) {
      throw new Error(
        'Attempted to make a cloudformation stack name with undefined values',
      );
    }

    return `${cfnStackPrefix}${appName || app}`;
  }

  /**
   * Returns the DeployConfig object representing the subcommand's
   * @author Jay Luker
   * @param {string} [profile=default]
   * @param {boolean} [keepSecretArns=false] - if true, for any parameter store values
   * that reference secretsmanager entries, preserve the secretsmanager ARN
   * value rather than dereferencing
   * @returns {DeployConfigData} deploy configuration associated with the current app (set by flag)
   */
  public async getDeployConfig(
    profile = 'default',
    keepSecretArns = false,
  ): Promise<DeployConfigData> {
    const { app } = this.flags;
    const appPrefix = this.getAppPrefix();
    try {
      const deployConfig = await DeployConfig.fromSsmParams(
        appPrefix,
        keepSecretArns,
        profile,
      );

      return deployConfig;
    } catch (error) {
      if (error instanceof AppNotFound) {
        this.exitWithError(`${app} app configuration not found!`);
      }
    }

    return DeployConfig.generate(this.context);
  }

  /**
   * Pull the CACCL deploy configuration from the config file location or create one if it doesn't exist.
   * Pulls from oclif config directory (this.config.configDir), but checks env-paths for backwards compatibility as well.
   *    - [oclif](https://oclif.io/docs/config)
   *    - [env-paths](https://www.npmjs.com/package/env-paths)
   * @author Benedikt Arnarsson
   * @returns {Promise<CacclDeployConfig>} parsed CACCL deploy CLI config
   */
  public async getConfigFromFile(): Promise<CacclDeployConfig> {
    // Backwards compatibility:
    const confPath = path.resolve(
      envPaths('caccl-deploy').config,
      'config.json',
    );
    if (fs.existsSync(confPath)) {
      const cliConfigJSON = fs.readFileSync(confPath, 'utf8');
      const cliConfig = JSON.parse(cliConfigJSON);

      return CacclDeployConfig.parse(cliConfig);
    }

    // New config file location:
    const configFile =
      this.flags.config ?? path.resolve(this.config.configDir, 'config.json');

    // check if this is the first time running and if so create the config file with defaults
    if (!fs.existsSync(configFile)) {
      const configDefaults = CacclDeployConfig.parse({});
      this.log(chalk.greenBright(figlet.textSync('Caccl-Deploy!')));
      this.log(
        [
          'It looks like this is your first time running caccl-deploy. ',
          `A preferences file has been created at ${chalk.yellow(configFile)}`,
          'with the following default values:',
          '',
          ...Object.entries(configDefaults).map(([k, v]) => {
            return `  - ${chalk.yellow(k)}: ${chalk.bold(JSON.stringify(v))}`;
          }),
          '',
          'Please see the docs for explanations of these settings',
        ].join('\n'),
      );

      this.flags.yes ||
        (await confirm('Continue?', true)) ||
        this.exitWithSuccess();

      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, JSON.stringify(configDefaults, null, '  '));
      return configDefaults;
    }

    const cliConfigJSON = fs.readFileSync(configFile, 'utf8');
    const cliConfig = JSON.parse(cliConfigJSON);

    return CacclDeployConfig.parse(cliConfig);
  }

  /**
   * Private method to exit the application with a message and an exit code.
   * @author Benedikt Arnarsson
   * @param {string} [msg='bye!'] message to display before exiting.
   * @param {number} [exitCode=0] exit code.
   */
  private bye(msg = 'bye!', exitCode = 0) {
    this.log(msg);
    this.exit(exitCode);
  }
}
