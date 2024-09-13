/* eslint-disable valid-jsdoc */
/* eslint-disable import/prefer-default-export */
/**
 * Base oclif Command to setup 'global' flags and context.
 * @author Benedikt Arnarsson
 */
// Import oclif
import { Command, Flags, Interfaces } from '@oclif/core';
// Import chalk
import chalk from 'chalk';
// Import figlet
import figlet from 'figlet';
// Import yn
import yn from 'yn';

// Import aws
import {
  AssumedRole,
  getCfnStackExports,
  initProfile,
  isConfigured,
} from './aws/index.js';
// Import config
import { conf, configDefaults, setConfigDefaults } from './conf.js';
// Import prompts
import { confirm } from './configPrompts/index.js';
// Import constants
import CACCL_DEPLOY_NON_INTERACTIVE from './constants/CACCL_DEPLOY_NON_INTERACTIVE.js';
import CACCL_DEPLOY_VERSION from './constants/CACCL_DEPLOY_VERSION.js';
// Import deploy config
import DeployConfig from './deployConfig/index.js';
// Import logger
import logger from './logger.js';
// Import errors
import AppNotFound from './shared/errors/AppNotFound.js';
import AwsProfileNotFound from './shared/errors/AwsProfileNotFound.js';
// Import helpers
import warnAboutVersionDiff from './shared/helpers/warnAboutVersionDiff.js';
// Import shared types
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
      default: conf.get('cfnStackPrefix'),
      description: 'cloudformation stack name prefix, e.g. "CacclDeploy-',
      helpGroup: 'GLOBAL',
      required: true,
    }),
    'ecr-access-role-arn': Flags.string({
      default: conf.get('ecrAccessRoleArn'),
      description: 'IAM role ARN for cross account ECR repo access',
      helpGroup: 'GLOBAL',
    }),
    'profile': Flags.string({
      default: 'default',
      description: 'activate a specific aws config/credential profile',
      helpGroup: 'GLOBAL',
    }),
    'ssm-root-prefix': Flags.string({
      default: conf.get('ssmRootPrefix'),
      description: 'The root prefix for ssm parameter store entries',
      helpGroup: 'GLOBAL',
      required: true,
    }),
    'yes': Flags.boolean({
      char: 'y',
      default: yn(CACCL_DEPLOY_NON_INTERACTIVE),
      description:
        'non-interactive, yes to everything, overwrite existing, etc',
      helpGroup: 'GLOBAL',
    }),
  };

  static description = 'A cli tool for managing ECS/Fargate app deployments';

  protected args!: Args<T>;

  public byeWithCredentialsError = () => {
    this.exitWithError(
      [
        'Looks like there is a problem with your AWS credentials configuration.',
        'Did you run `aws configure`? Did you set a region? Default profile?',
      ].join('\n'),
    );
  };

  public ecrAccessRoleArn?: string;
  public exitWithError = (msg?: string) => {
    this.bye(msg, 1);
  };

  public exitWithSuccess = (msg?: string) => {
    this.bye(msg);
  };

  protected flags!: Flags<T>;

  public initAwsProfile = async (profile: string): Promise<string> => {
    try {
      initProfile(profile);
      return profile;
    } catch (error) {
      if (error instanceof AwsProfileNotFound) {
        this.exitWithError(error.message);
      } else {
        throw error;
      }
    }

    return profile;
  };

  private assumedRole?: AssumedRole;

  protected async catch(err: { exitCode?: number } & Error): Promise<any> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err);
  }

  protected async finally(_: Error | undefined): Promise<any> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_);
  }

  /**
   * Convenience method for getting the combined root prefix plus app name
   * used for the SSM Paramter Store parameter names
   * @param {string} appName
   */
  getAppPrefix(appName?: string) {
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

  public getAssumedRole(): AssumedRole {
    if (!this.assumedRole) {
      this.assumedRole = new AssumedRole();
    }

    return this.assumedRole;
  }

  /**
   * Convenience method for getting the name of the app's CloudFormation stack
   * @param {string} appName
   */
  getCfnStackName(appName?: string) {
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
   * Retruns the DeployConfig object representing the subcommand's
   *
   * @param {boolean} keepSecretArns - if true, for any parameter store values
   * that reference secretsmanager entries, preserve the secretsmanager ARN
   * value rather than dereferencing
   */
  async getDeployConfig(
    assumedRole: AssumedRole,
    keepSecretArns?: boolean,
  ): Promise<DeployConfigData> {
    const { app } = this.flags;
    const appPrefix = this.getAppPrefix();
    try {
      const deployConfig = await DeployConfig.fromSsmParams(
        appPrefix,
        keepSecretArns,
      );

      return deployConfig;
    } catch (error) {
      if (error instanceof AppNotFound) {
        this.exitWithError(`${app} app configuration not found!`);
      }
    }

    return DeployConfig.generate(assumedRole);
  }

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

    // No need for credentials while testing
    if (process.env.NODE_ENV !== 'test') {
      // Initialize the AWS profile
      await this.initAwsProfile(this.flags.profile);

      // confirm ASAP that the user's AWS creds/config is good to go
      if (!isConfigured()) {
        this.byeWithCredentialsError();
      }
    }

    /*
     * check if this is the first time running and if so create the
     * config file with defaults
     */
    if (!conf.get('ssmRootPrefix')) {
      this.log(chalk.greenBright(figlet.textSync('Caccl-Deploy!')));
      this.log(
        [
          'It looks like this is your first time running caccl-deploy. ',
          `A preferences file has been created at ${chalk.yellow(conf.path)}`,
          'with the following default values:',
          '',
          ...Object.entries(configDefaults).map(([k, v]) => {
            return `  - ${chalk.yellow(k)}: ${chalk.bold(JSON.stringify(v))}`;
          }),
          '',
          'Please see the docs for explanations of these settings',
        ].join('\n'),
      );

      CACCL_DEPLOY_NON_INTERACTIVE ||
        (await confirm('Continue?', true)) ||
        this.exitWithSuccess();
      setConfigDefaults();
    }
  }

  /**
   * Will add another confirm prompt that warns if the deployed stack's
   * version is more than a patch version different from the cli tool.
   *
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  async stackVersionDiffCheck() {
    const cfnStackName = this.getCfnStackName();
    const cfnExports = await getCfnStackExports(cfnStackName);
    const stackVersion = cfnExports.cacclDeployVersion;
    const cliVersion = CACCL_DEPLOY_VERSION;
    if (
      cliVersion === stackVersion ||
      !warnAboutVersionDiff(stackVersion, cliVersion)
    ) {
      return true;
    }

    const confirmMsg = `Stack deployed with ${chalk.redBright(
      stackVersion,
    )}; you are using ${chalk.redBright(cliVersion)}. Proceed?`;
    return confirm(confirmMsg, false);
  }

  private bye(msg = 'bye!', exitCode = 0) {
    this.log(msg);
    this.exit(exitCode);
  }
}
