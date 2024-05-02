// Import chalk
import chalk from 'chalk';

// Import commander
import { Command } from 'commander';

// Import yn
import yn from 'yn';

// Import shared types
import { DeployConfigData } from '../../../types';

// Import aws
import { AssumedRole, getCfnStackExports } from '../../aws';

// Import conf
import { conf } from '../../conf';

// Import prompts
import { confirm } from '../../configPrompts';

// Import deploy config
import DeployConfig from '../../deployConfig';

// Import shared errors
import AppNotFound from '../../shared/errors/AppNotFound';

// Import shared helpers
import warnAboutVersionDiff from '../../shared/helpers/warnAboutVersionDiff';

// Import constants
import CACCL_DEPLOY_NON_INTERACTIVE from '../constants/CACCL_DEPLOY_NON_INTERACTIVE';
import CACCL_DEPLOY_VERSION from '../constants/CACCL_DEPLOY_VERSION';

// Import helpers
import exitWithError from '../helpers/exitWithError';
import initAwsProfile from '../helpers/initAwsProfile';

/**
 * Extends the base commander.js class to add convenience methods
 * and some common options
 * @extends Command
 */
class CacclDeployCommander extends Command {
  private assumedRole?: AssumedRole;

  public ecrAccessRoleArn?: string;

  /**
   * custom command creator
   * @param {string} name
   */
  createCommand(name?: string) {
    const cmd = new CacclDeployCommander(name)
      /**
       * Enabling the following two command options allows our `action()` block
       * to receive the command object as an argument and to reference command
       * options as properties of that object, e.g. the value of `--app` can be
       * accessed via `cmd.app`, or `this.app` in the added methods in this
       * class
       */
      .passCommandToAction()
      .storeOptionsAsProperties()
      // adds a bunch of options (mostly) common to all the subcommands
      .commonOptions();
    return cmd;
  }

  /**
   * Convenience method for getting the combined root prefix plus app name
   * used for the SSM Paramter Store parameter names
   * @param {string} appName
   */
  getAppPrefix(appName?: string) {
    if (
      this.ssmRootPrefix === undefined ||
      (this.app === undefined && appName === undefined)
    ) {
      throw Error('Attempted to make an ssm prefix with undefined values');
    }
    return `${this.ssmRootPrefix}/${appName || this.app}`;
  }

  /**
   * Convenience method for getting the name of the app's CloudFormation stack
   * @param {string} appName
   */
  getCfnStackName(appName?: string) {
    if (
      this.cfnStackPrefix === undefined ||
      (this.app === undefined && appName === undefined)
    ) {
      throw Error(
        'Attempted to make a cloudformation stack name with undefined values',
      );
    }
    return `${this.cfnStackPrefix}${appName || this.app}`;
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
    const appPrefix = this.getAppPrefix();
    try {
      const deployConfig = await DeployConfig.fromSsmParams(
        appPrefix,
        keepSecretArns,
      );

      return deployConfig;
    } catch (err) {
      if (err instanceof AppNotFound) {
        exitWithError(`${this.app} app configuration not found!`);
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

  /**
   * For assigning some common options to all commands
   *
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  commonOptions() {
    return this.option(
      '--profile <string>',
      'activate a specific aws config/credential profile',
      initAwsProfile,
    )
      .option(
        '--ecr-access-role-arn <string>',
        'IAM role ARN for cross account ECR repo access',
        conf.get('ecrAccessRoleArn'),
      )
      .requiredOption(
        '--ssm-root-prefix <string>',
        'The root prefix for ssm parameter store entries',
        conf.get('ssmRootPrefix'),
      )
      .requiredOption(
        '--cfn-stack-prefix <string>',
        'cloudformation stack name prefix, e.g. "CacclDeploy-"',
        conf.get('cfnStackPrefix'),
      )
      .option(
        '-y --yes',
        'non-interactive, yes to everything, overwrite existing, etc',
        yn(CACCL_DEPLOY_NON_INTERACTIVE),
      );
  }

  /**
   * Add the `--app` option to a command
   *
   * @param {boolean} optional - unless true the resulting command option
   *  will be required
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  appOption(optional?: boolean) {
    return optional
      ? this.option('-a --app <string>', 'name of the app to work with')
      : this.requiredOption(
        '-a --app <string>',
        'name of the app to work with',
      );
  }

  public getAssumedRole(): AssumedRole {
    if (!this.assumedRole) {
      this.assumedRole = new AssumedRole();
    }
    return this.assumedRole;
  }
}

export default CacclDeployCommander;
