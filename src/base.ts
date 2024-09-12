/**
 * Base oclif Command to setup 'global' flags and context.
 * @author Benedikt Arnarsson
 */
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import chalk
import chalk from 'chalk';

// Import figlet
import figlet from 'figlet';

// Import oclif
import { Command, Flags, Interfaces } from '@oclif/core'

// Import yn
import yn from 'yn';

// Import aws
import { isConfigured, AssumedRole, getCfnStackExports, initProfile } from './aws/index.js';

// Import config
import { conf, configDefaults, setConfigDefaults } from './conf.js';

// Import prompts
import { confirm } from './configPrompts/index.js';

// Import deploy config
import DeployConfig from './deployConfig/index.js';

// Import constants
import CACCL_DEPLOY_NON_INTERACTIVE from './constants/CACCL_DEPLOY_NON_INTERACTIVE.js';
import CACCL_DEPLOY_VERSION from './constants/CACCL_DEPLOY_VERSION.js';

// Import helpers
import warnAboutVersionDiff from './shared/helpers/warnAboutVersionDiff.js';

// Import logger
import logger from './logger.js';

// Import shared types
import { DeployConfigData } from './types/index.js';

// Import errors
import AppNotFound from './shared/errors/AppNotFound.js';
import AwsProfileNotFound from './shared/errors/AwsProfileNotFound.js';

// Types
type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseCommand['baseFlags'] & T['flags']>
type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

/**
 * Base caccl-deploy Command, defining common flags, capabilities, and initialization logic.
 * @author Benedikt Arnarsson
 */
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static description = 'A cli tool for managing ECS/Fargate app deployments';

  private assumedRole?: AssumedRole;

  public ecrAccessRoleArn?: string;

  // define flags that can be inherited by any command that extends BaseCommand
  static baseFlags = {
    'profile': Flags.string({
      helpGroup: 'GLOBAL',
      description: 'activate a specific aws config/credential profile',
      default: 'default',
    }),
    'ecr-access-role-arn': Flags.string({
      helpGroup: 'GLOBAL',
      description: 'IAM role ARN for cross account ECR repo access',
      default: conf.get('ecrAccessRoleArn'),
    }),
    'ssm-root-prefix': Flags.string({
      helpGroup: 'GLOBAL',
      required: true,
      description: 'The root prefix for ssm parameter store entries',
      default: conf.get('ssmRootPrefix'),
    }),
    'cfn-stack-prefix': Flags.string({
      helpGroup: 'GLOBAL',
      required: true,
      description: 'cloudformation stack name prefix, e.g. "CacclDeploy-',
      default: conf.get('cfnStackPrefix'),
    }),
    'yes': Flags.boolean({
      char: 'y',
      helpGroup: 'GLOBAL',
      description: 'non-interactive, yes to everything, overwrite existing, etc',
      default: yn(CACCL_DEPLOY_NON_INTERACTIVE),
    }),
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      hidden: true,
    }),
  };

  protected flags!: Flags<T>;
  protected args!: Args<T>;

  public async init(): Promise<void> {
    // Set the logger
    logger.setLogger(this.log, this.logToStderr);

    // Parse args and flags
    await super.init()
    const {args, flags} = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    })
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
  
    // No need for credentials while testing
    if (process.env.NODE_ENV !== 'test') {
      // Initialize the AWS profile
      this.initAwsProfile(this.flags.profile);

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
   * Convenience method for getting the combined root prefix plus app name
   * used for the SSM Paramter Store parameter names
   * @param {string} appName
   */
  getAppPrefix(appName?: string) {
    // Destructure flags
    const {
      'ssm-root-prefix': ssmRootPrefix,
      app,
    } = this.flags;
  
    if (
      ssmRootPrefix === undefined ||
      (app === undefined && appName === undefined)
    ) {
      throw Error('Attempted to make an ssm prefix with undefined values');
    }
    return `${ssmRootPrefix}/${appName || app}`;
  }

  /**
   * Convenience method for getting the name of the app's CloudFormation stack
   * @param {string} appName
   */
  getCfnStackName(appName?: string) {
    // Destructure flags
    const {
      'cfn-stack-prefix': cfnStackPrefix,
      app,
    } = this.flags;
  
    if (
      cfnStackPrefix === undefined ||
      (app === undefined && appName === undefined)
    ) {
      throw Error(
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
    } catch (err) {
      if (err instanceof AppNotFound) {
        this.exitWithError(`${app} app configuration not found!`);
      }
    }
    return DeployConfig.generate(assumedRole);
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

  public getAssumedRole(): AssumedRole {
    if (!this.assumedRole) {
      this.assumedRole = new AssumedRole();
    }
    return this.assumedRole;
  }

  private bye(msg = 'bye!', exitCode = 0) {
    this.log(msg);
    this.exit(exitCode);
  }

  public exitWithSuccess = (msg?: string) => {
    this.bye(msg);
  }

  public exitWithError = (msg?: string) => {
    this.bye(msg, 1);
  }

  public byeWithCredentialsError = () => {
    this.exitWithError(
      [
        'Looks like there is a problem with your AWS credentials configuration.',
        'Did you run `aws configure`? Did you set a region? Default profile?',
      ].join('\n'),
    );
  };

  public initAwsProfile = async (profile: string): Promise<string> => {
    try {
      initProfile(profile);
      return profile;
    } catch (err) {
      if (err instanceof AwsProfileNotFound) {
        this.exitWithError(err.message);
      } else {
        throw err;
      }
    }
    return profile;
  };

  protected async catch(err: Error & {exitCode?: number}): Promise<any> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err)
  }

  protected async finally(_: Error | undefined): Promise<any> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_)
  }
}