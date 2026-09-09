#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const chalk = require('chalk');
const { Command } = require('commander');
const figlet = require('figlet');
const moment = require('moment');
const { table } = require('table');
const tempy = require('tempy');
const yn = require('yn');

const aws = require('./lib/aws');
const { conf, setConfigDefaults, configDefaults } = require('./lib/conf');
const {
  promptAppName,
  confirm,
  confirmProductionOp,
} = require('./lib/configPrompts');
const DeployConfig = require('./lib/deployConfig');
const {
  AppNotFound,
  UserCancel,
  AwsProfileNotFound,
  NoPromptChoices,
  CfnStackNotFound,
} = require('./lib/errors');
const cacclDeployVersion = require('./lib/generateVersion')();
const {
  looksLikeSemver,
  validSSMParamName,
  warnAboutVersionDiff,
  waitForLocalPortOpen,
  localPortIsFree,
} = require('./lib/helpers');

const SSM_PORT_FORWARDING_DOCUMENT =
  'AWS-StartPortForwardingSessionToRemoteHost';

/**
 * Shell variable holding the id of a bastion that doesn't exist yet; the
 * --print-only recipe populates it from the launcher's response
 */
const INSTANCE_ID_VAR = '$INSTANCE_ID';

// where the printed `lambda invoke` command writes the launcher's response
const BASTION_RESPONSE_FILE = '/tmp/bastion.json';

/**
 * Single-quote a command argument unless it's made up entirely of characters
 * the shell leaves alone, so that printed commands can be pasted as-is
 * @param {string} arg
 * @returns {string}
 */
const shellQuote = (arg) => {
  if (/^[A-Za-z0-9_\-=:/.,]+$/.test(arg)) {
    return arg;
  }
  // double quotes so that shell variables still expand when pasted
  if (arg.includes(INSTANCE_ID_VAR)) {
    return `"${arg}"`;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
};

/**
 * Render an argument list as a copy-pasteable `aws` command
 * @param {string[]} args
 * @returns {string}
 */
const printableAwsCommand = (args) => {
  return `aws ${args.map(shellQuote).join(' ')}`;
};

/**
 * Determine the major version of the local `aws` cli. v2 interprets a
 * `--payload` as base64 unless told otherwise, while v1 has no
 * `--cli-binary-format` option at all, so printed commands have to differ.
 * @returns {number} the major version, or 1 if it can't be determined
 */
const getAwsCliMajorVersion = () => {
  try {
    const output = execSync('aws --version 2>&1').toString();
    const match = output.match(/aws-cli\/(\d+)/);
    return match ? Number(match[1]) : 1;
  } catch (err) {
    return 1;
  }
};
const { description: packageDescription } = require('./package.json');

/**
 * Setting this env var is the equivalent of passing the `--yes` argument
 * to any subcommand. It tells caccl-deploy to not prompt for confirmations.
 * This includes production account failsafe prompts, so be careful.
 */
const { CACCL_DEPLOY_NON_INTERACTIVE = false } = process.env;

const bye = (msg = 'bye!', exitCode = 0) => {
  console.log(msg);
  process.exit(exitCode);
};

const exitWithSuccess = (msg) => {
  bye(msg);
};

const exitWithError = (msg) => {
  bye(msg, 1);
};

const byeWithCredentialsError = () => {
  exitWithError(
    [
      'Looks like there is a problem with your AWS credentials configuration.',
      'Did you run `aws configure`? Did you set a region? Default profile?',
    ].join('\n'),
  );
};

/**
 * callback function for the `--profile` option
 * @param {string} profile
 */
const initAwsProfile = (profile) => {
  try {
    aws.initProfile(profile);
    return profile;
  } catch (err) {
    if (err instanceof AwsProfileNotFound) {
      exitWithError(err.message);
    } else {
      throw err;
    }
  }
};

const isProdAccount = async () => {
  const prodAccounts = conf.get('productionAccounts');
  const accountId = await aws.getAccountId();
  return prodAccounts && prodAccounts.includes(accountId);
};

/**
 * Assemble the object structure with all the info the CDK stack
 * operations (diff, deploy, etc) will need
 * @param {CacclDeployCommander} cmd
 * @param {object} deployConfig - deploy config with unresolved secrets
 *   (secretsmanager ARNs intact) for passing to cdk
 * @param {string} deployConfigHash - hash of the resolved deploy config
 */
const getCdkStackProps = async (cmd, deployConfig, deployConfigHash) => {
  /**
   * Get the important ids/names from our infrastructure stack:
   *   - id of the vpc
   *   - name of the ECS cluster
   *   - name of the S3 bucket where the load balancer will send logs
   */
  const { vpcId, ecsClusterName, albLogBucketName } =
    await aws.getCfnStackExports(deployConfig.infraStackName);

  const cdkStackProps = {
    vpcId,
    ecsClusterName,
    albLogBucketName,
    cacclDeployVersion,
    deployConfigHash,
    stackName: cmd.getCfnStackName(),
    awsAccountId: await aws.getAccountId(),
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    deployConfig,
  };

  // Set some default removal policy options depending on if this is a "prod" account
  if (
    cdkStackProps.deployConfig.dbOptions &&
    !cdkStackProps.deployConfig.dbOptions.removalPolicy
  ) {
    cdkStackProps.deployConfig.dbOptions.removalPolicy = (await isProdAccount())
      ? 'RETAIN'
      : 'DESTROY';
  }

  return cdkStackProps;
};

/**
 * Execute a cdk subprocess operation
 * @param {string[]} cdkArgs - args/options for the cdk process
 * @param {object} cdkStackProps
 * @param {string} profile - aws config/credentials profile name
 */
const execCdk = async (cdkArgs, cdkStackProps, profile) => {
  const args = [...cdkArgs];

  const envAdditions = {
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    CDK_DISABLE_VERSION_CHECK: true,
  };

  // tell cdk to use the same profile
  if (profile !== undefined) {
    args.push('--profile', profile);
    envAdditions.AWS_PROFILE = profile;
  }

  /**
   * Write out the stack properties to a temp json file for
   * the CDK subprocess to pick up
   */
  await tempy.write.task(
    JSON.stringify(cdkStackProps, null, 2),
    async (tempPath) => {
      // tell the CDK subprocess where to find the stack properties file
      envAdditions.CDK_STACK_PROPS_FILE_PATH = tempPath;

      const execOpts = {
        stdio: 'inherit',
        // exec the cdk process in the cdk directory
        cwd: __dirname, // path.join(__dirname, 'cdk'),
        // inject our additional env vars
        env: { ...process.env, ...envAdditions },
      };

      execSync(['node_modules/.bin/cdk', ...args].join(' '), execOpts);
    },
  );
};

/**
 * Extends the base commander.js class to add convenience methods
 * and some common options
 * @extends Command
 */
class CacclDeployCommander extends Command {
  /**
   * custom command creator
   * @param {string} name
   */
  createCommand(name) {
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
  getAppPrefix(appName) {
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
  getCfnStackName(appName) {
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
  async getDeployConfig(keepSecretArns) {
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
    const cfnExports = await aws.getCfnStackExports(cfnStackName);
    const stackVersion = cfnExports.cacclDeployVersion;
    const cliVersion = cacclDeployVersion;

    if (
      stackVersion === undefined ||
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
  appOption(optional) {
    const args = ['-a --app <string>', 'name of the app to work with'];
    return optional ? this.option(...args) : this.requiredOption(...args);
  }
}

async function main() {
  // confirm ASAP that the user's AWS creds/config is good to go
  if (!aws.isConfigured() && process.env.NODE_ENV !== 'test') {
    byeWithCredentialsError();
  }

  /*
   * check if this is the first time running and if so create the
   * config file with defaults
   */
  if (!conf.get('ssmRootPrefix')) {
    console.log(chalk.greenBright(figlet.textSync('Caccl-Deploy!')));
    console.log(
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
      exitWithSuccess();
    setConfigDefaults();
  }

  const cli = new CacclDeployCommander()
    .version(cacclDeployVersion)
    .description([packageDescription, `config: ${conf.path}`].join('\n'));

  cli
    .command('apps')
    .option(
      '--full-status',
      'show the full status of each app including CFN stack and config state',
    )
    .description('list available app configurations')
    .action(async (cmd) => {
      const apps = await aws.getAppList(cmd.ssmRootPrefix);

      if (!apps.length) {
        exitWithError(
          `No app configurations found using ssm root prefix ${cmd.ssmRootPrefix}`,
        );
      }

      const appData = {};
      const tableColumns = ['App'];

      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        appData[app] = [];
      }

      if (cmd.fullStatus) {
        tableColumns.push(
          'Infra Stack',
          'Stack Status',
          'Config Drift',
          'caccl-deploy Version',
        );
        const cfnStacks = await aws.getCfnStacks(cmd.cfnStackPrefix);

        for (let i = 0; i < apps.length; i++) {
          const app = apps[i];
          const cfnStackName = cmd.getCfnStackName(app);

          const appPrefix = cmd.getAppPrefix(app);
          const deployConfig = await DeployConfig.fromSsmParams(appPrefix);
          appData[app].push(deployConfig.infraStackName);

          const cfnStack = cfnStacks.find((s) => {
            return (
              s.StackName === cfnStackName &&
              s.StackStatus !== 'DELETE_COMPLETE'
            );
          });
          if (!cfnStack) {
            // config exists but cfn stack not deployed yet (or was destroyed)
            appData[app].push('', '', '');
            continue;
          }

          /**
           * Compare a hash of the config used during stack deployment to the
           * has of the current config
           */
          let configDrift = '?';
          const cfnStackDeployConfigHashOutput = cfnStack.Outputs.find((o) => {
            return o.OutputKey.startsWith('DeployConfigHash');
          });

          if (cfnStackDeployConfigHashOutput) {
            const deployConfigHash = deployConfig.toHash();
            const cfnOutputValue = cfnStackDeployConfigHashOutput.OutputValue;
            configDrift = cfnOutputValue !== deployConfigHash ? 'yes' : 'no';
          }
          appData[app].push(cfnStack.StackStatus, configDrift);

          const cfnStackCacclDeployVersion = cfnStack.Outputs.find((o) => {
            return o.OutputKey.startsWith('CacclDeployVersion');
          });
          appData[app].push(cfnStackCacclDeployVersion.OutputValue);
        }
      }
      const tableData = Object.keys(appData).map((app) => {
        return [app, ...appData[app]];
      });

      exitWithSuccess(table([tableColumns, ...tableData]));
    });

  cli
    .command('new')
    .description('create a new app deploy config via import and/or prompts')
    .appOption(true)
    .option(
      '-i --import <string>',
      'import new deploy config from a json file or URL',
    )
    .description('create a new app configuration')
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const existingApps = await aws.getAppList(cmd.ssmRootPrefix);

      let appName;
      try {
        appName = cmd.app || (await promptAppName());
      } catch (err) {
        if (err instanceof UserCancel) {
          exitWithSuccess();
        }
        throw err;
      }

      const appPrefix = cmd.getAppPrefix(appName);

      if (existingApps.includes(appName)) {
        const cfnStackName = cmd.getCfnStackName(appName);
        if (await aws.cfnStackExists(cfnStackName)) {
          exitWithError('A deployed app with that name already exists');
        } else {
          console.log(`Configuration for ${cmd.app} already exists`);
        }

        if (cmd.yes || (await confirm('Overwrite?'))) {
          if (!(await confirmProductionOp(cmd.yes))) {
            exitWithSuccess();
          }
          await DeployConfig.wipeExisting(appPrefix);
        } else {
          exitWithSuccess();
        }
      }

      /**
       * Allow importing some or all of a deploy config.
       * What gets imported will be passed to the `generate`
       * operation to complete any missing settings
       */
      let importedConfig;
      if (cmd.import !== undefined) {
        importedConfig = /^http(s):\//.test(cmd.import)
          ? await DeployConfig.fromUrl(cmd.import)
          : DeployConfig.fromFile(cmd.import);
      }

      let deployConfig;
      try {
        deployConfig = await DeployConfig.generate(importedConfig);
      } catch (err) {
        if (err instanceof UserCancel) {
          exitWithSuccess();
        } else if (err instanceof NoPromptChoices) {
          exitWithError(
            [
              'Something went wrong trying to generate your config: ',
              err.message,
            ].join('\n'),
          );
        }
        throw err;
      }

      await deployConfig.syncToSsm(appPrefix);
      exitWithSuccess(
        [
          chalk.yellowBright(figlet.textSync(`${appName}!`)),
          '',
          'Your new app deployment configuration is created!',
          'Next steps:',
          `  * modify or add settings with 'caccl-deploy update -a ${appName} [...]'`,
          `  * deploy the app stack with 'caccl-deploy stack -a ${appName} deploy'`,
          '',
        ].join('\n'),
      );
    });

  cli
    .command('delete')
    .description('delete an app configuration')
    .appOption()
    .action(async (cmd) => {
      const cfnStackName = cmd.getCfnStackName();
      if (await aws.cfnStackExists(cfnStackName)) {
        exitWithError(
          [
            `You must first run "caccl-deploy stack -a ${cmd.app} destroy" to delete`,
            `the deployed ${cfnStackName} CloudFormation stack before deleting it's config.`,
          ].join('\n'),
        );
      }

      try {
        console.log(
          `This will delete all deployment configuation for ${cmd.app}`,
        );

        if (!(cmd.yes || (await confirm('Are you sure?')))) {
          exitWithSuccess();
        }
        // extra confirm if this is a production deployment
        if (!(await confirmProductionOp(cmd.yes))) {
          exitWithSuccess();
        }

        await DeployConfig.wipeExisting(cmd.getAppPrefix(), false);

        exitWithSuccess(`${cmd.app} configuration deleted`);
      } catch (err) {
        if (err instanceof AppNotFound) {
          exitWithError(`${cmd.app} app configuration not found!`);
        }
      }
    });

  cli
    .command('show')
    .description("display an app's current configuration")
    .appOption()
    .option('-f --flat', 'display the flattened, key: value form of the config')
    .option('-s --sha', 'output a sha1 hash of the current configuration')
    .option(
      '--keep-secret-arns',
      'show app environment secret value ARNs instead of dereferencing',
    )
    .action(async (cmd) => {
      // we only want to see that sha1 hash (likely for debugging)
      if (cmd.sha) {
        exitWithSuccess((await cmd.getDeployConfig()).toHash());
      }
      exitWithSuccess(
        (await cmd.getDeployConfig(cmd.keepSecretArns)).toString(
          true,
          cmd.flat,
        ),
      );
    });

  cli
    .command('update')
    .description('update (or delete) a single deploy config setting')
    .appOption()
    .option(
      '-D --delete',
      'delete the named parameter instead of creating/updating',
    )
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig(true);

      if (!(await confirmProductionOp(cmd.yes))) {
        exitWithSuccess();
      }

      if (cmd.args.length > 2) {
        exitWithError('Too many arguments!');
      }

      try {
        if (cmd.delete) {
          const [param] = cmd.args;
          await deployConfig.delete(cmd.getAppPrefix(), param);
        } else {
          const [param, value] = cmd.args;
          if (!validSSMParamName(param)) {
            throw new Error(`Invalid param name: '${param}'`);
          }
          await deployConfig.update(cmd.getAppPrefix(), param, value);
        }
      } catch (err) {
        exitWithError(`Something went wrong: ${err.message}`);
      }
    });

  cli
    .command('repos')
    .description('list the available ECR repositories')
    .action(async (cmd) => {
      // see the README section on cross-account ECR access
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const repos = await aws.getRepoList();
      const data = repos.map((r) => {
        return [r];
      });

      if (data.length) {
        const tableOutput = table([['Respository Name'], ...data]);
        exitWithSuccess(tableOutput);
      }
      exitWithError('No ECR repositories found');
    });

  cli
    .command('images')
    .description('list the most recent available ECR images for an app')
    .requiredOption(
      '-r --repo <string>',
      'the name of the ECR repo; use `caccl-deploy app repos` for available repos',
    )
    .option(
      '-A --all',
      'show all images; default is to show only semver-tagged releases',
    )
    .action(async (cmd) => {
      // see the README section on cross-account ECR access
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const images = await aws.getRepoImageList(cmd.repo, cmd.all);
      const region = aws.getCurrentRegion();

      /**
       * Function to filter for the image tags we want.
       * If `--all` flag is provided this will return true for all tags.
       * Otherwise only tags that look like e.g. "1.1.1" or master/stage
       * will be included.
       */
      const includeThisTag = (t) => {
        return cmd.all || looksLikeSemver(t) || ['master', 'stage'].includes(t);
      };

      const data = images.map((i) => {
        const imageTags = i.imageTags.filter(includeThisTag).join('\n');

        /**
         * Filter then list of image ids for just the ones that correspond
         * to the image tags we want to include
         */
        const imageArns = i.imageTags
          .reduce((collect, t) => {
            if (includeThisTag(t)) {
              collect.push(
                aws.createEcrArn({
                  repoName: cmd.repo,
                  imageTag: t,
                  account: i.registryId,
                  region,
                }),
              );
            }
            return collect;
          }, [])
          .join('\n');

        return [moment(i.imagePushedAt).format(), imageTags, imageArns];
      });
      if (data.length) {
        const tableOutput = table([['Pushed On', 'Tags', 'ARNs'], ...data]);
        exitWithSuccess(tableOutput);
      }
      exitWithError('No images found');
    });

  cli
    .command('stack')
    .description("diff, deploy, or delete the app's AWS resources")
    .appOption()
    .action(async (cmd) => {
      // get this without resolved secrets for passing to cdk
      const deployConfig = await cmd.getDeployConfig(true);

      // get it again with resolved secrets so we can make our hash
      const deployConfigHash = (await cmd.getDeployConfig()).toHash();

      const cfnStackName = cmd.getCfnStackName();
      const stackExists = await aws.cfnStackExists(cfnStackName);

      const cdkStackProps = await getCdkStackProps(
        cmd,
        deployConfig,
        deployConfigHash,
      );

      // all args/options following the `stack` subcommand get passed to cdk
      const cdkArgs = [...cmd.args];

      // default cdk operation is `list`
      if (!cdkArgs.length) {
        cdkArgs.push('list');
      } else if (cdkArgs[0] === 'dump') {
        exitWithSuccess(JSON.stringify(cdkStackProps, null, '  '));
      } else if (cdkArgs[0] === 'info') {
        if (!stackExists) {
          exitWithError(`Stack ${cfnStackName} has not been deployed yet`);
        }
        const stackExports = await aws.getCfnStackExports(cfnStackName);
        exitWithSuccess(JSON.stringify(stackExports, null, '  '));
      } else if (cdkArgs[0] === 'changeset') {
        cdkArgs.shift();
        cdkArgs.unshift('deploy', '--no-execute');
      }

      // disable cdk prompting if user included `--yes` flag
      if (
        cmd.yes &&
        (cdkArgs.includes('deploy') || cdkArgs.includes('changeset'))
      ) {
        cdkArgs.push('--require-approval-never');
      }

      if (
        ['deploy', 'destroy', 'changeset'].some((c) => {
          return cdkArgs.includes(c);
        })
      ) {
        // check that we're not using a wildly different version of the cli
        if (stackExists && !cmd.yes && !(await cmd.stackVersionDiffCheck())) {
          exitWithSuccess();
        }
        // production failsafe if we're actually changing anything
        if (!(await confirmProductionOp(cmd.yes))) {
          exitWithSuccess();
        }
      }

      try {
        await execCdk(cdkArgs, cdkStackProps, cmd.profile);
        exitWithSuccess('done!');
      } catch (err) {
        exitWithError(err.msg);
      }
    });

  cli
    .command('restart')
    .description('no changes; just force a restart')
    .appOption()
    .action(async (cmd) => {
      const cfnStackName = cmd.getCfnStackName();
      let cfnExports;
      try {
        cfnExports = await aws.getCfnStackExports(cfnStackName);
      } catch (err) {
        if (err instanceof CfnStackNotFound) {
          exitWithError(err.message);
        }
        throw err;
      }
      const { clusterName, serviceName } = cfnExports;
      console.log(
        `Restarting service ${serviceName} on cluster ${clusterName}`,
      );

      if (!(await confirmProductionOp(cmd.yes))) {
        exitWithSuccess();
      }

      // restart the service
      await aws.restartEcsServcie(clusterName, serviceName, { wait: true });
      exitWithSuccess('done');
    });

  cli
    .command('release')
    .description('release a new version of an app')
    .appOption()
    .requiredOption(
      '-i --image-tag <string>',
      'the docker image version tag to release',
    )
    .action(async (cmd) => {
      // see the README section on cross-account ECR access
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }

      // get this without resolved secrets for passing to cdk
      const deployConfig = await cmd.getDeployConfig(true);

      // get it again with resolved secrets so we can make our hash
      const resolvedDeployConfig = await cmd.getDeployConfig();

      const cfnStackName = cmd.getCfnStackName();
      if (!(await aws.cfnStackExists(cfnStackName))) {
        exitWithError(`Stack ${cfnStackName} has not been deployed yet`);
      }

      /**
       * caccl-deploy allows non-ECR images, but in the `caccl-deploy` context
       * we can assume that `appImage` will be an ECR repo ARN
       */
      const repoArn = aws.parseEcrArn(deployConfig.appImage);

      // check that we're actually releasing a different image
      if (repoArn.imageTag === cmd.imageTag && !cmd.yes) {
        const confirmMsg = `${cmd.app} is already using image tag ${cmd.imageTag}`;
        (await confirm(`${confirmMsg}. Proceed?`)) || exitWithSuccess();
      }

      // check that the specified image tag is legit
      console.log(`Checking that an image exists with the tag ${cmd.imageTag}`);
      const imageTagExists = await aws.imageTagExists(
        repoArn.repoName,
        cmd.imageTag,
      );
      if (!imageTagExists) {
        exitWithError(
          `No image with tag ${cmd.imageTag} in ${repoArn.repoName}`,
        );
      }

      // check if it's the latest release and prompt if not
      console.log(`Checking ${cmd.imageTag} is the latest tag`);
      const isLatestTag = await aws.isLatestTag(repoArn.repoName, cmd.imageTag);
      if (!isLatestTag && !cmd.yes) {
        console.log(`${cmd.imageTag} is not the most recent release`);
        (await confirm('Proceed?')) || exitWithSuccess();
      }

      // generate the new repo image arn to be deployed
      const newAppImage = aws.createEcrArn({
        ...repoArn,
        imageTag: cmd.imageTag,
      });

      // check that we're not using a wildly different version of the cli
      if (!cmd.yes && !(await cmd.stackVersionDiffCheck())) {
        exitWithSuccess();
      }

      if (!(await confirmProductionOp(cmd.yes))) {
        exitWithSuccess();
      }

      /**
       * update the appImage value on the in-memory deploy configs only;
       * nothing is persisted until after the diff is confirmed
       */
      deployConfig.appImage = newAppImage;
      resolvedDeployConfig.appImage = newAppImage;

      const cdkStackProps = await getCdkStackProps(
        cmd,
        deployConfig,
        resolvedDeployConfig.toHash(),
      );

      // show what the stack update will change
      console.log(`Generating diff of the ${cfnStackName} stack update...`);
      try {
        await execCdk(['diff'], cdkStackProps, cmd.profile);
      } catch (err) {
        exitWithError(err.message);
      }

      if (!cmd.yes && !(await confirm('Proceed with deployment?'))) {
        exitWithSuccess();
      }

      // update the ssm parameter
      console.log('Updating stored deployment configuration');
      await deployConfig.update(cmd.getAppPrefix(), 'appImage', newAppImage);

      /**
       * deploy the stack update; the diff was already confirmed (or `--yes`
       * was passed) so cdk's own approval prompt is bypassed
       */
      try {
        await execCdk(
          ['deploy', '--require-approval', 'never'],
          cdkStackProps,
          cmd.profile,
        );
      } catch (err) {
        exitWithError(
          [
            err.message,
            `WARNING: the ${cmd.app} deployment configuration has been updated`,
            `to use ${newAppImage} but the stack update did not complete.`,
            `Run 'caccl-deploy stack -a ${cmd.app} deploy' to retry.`,
          ].join('\n'),
        );
      }
      exitWithSuccess('done.');
    });

  cli
    .command('exec')
    .description('execute a one-off task using the app image')
    .appOption()
    .requiredOption('-c, --command <string>', 'the app task command to run')
    .option(
      '-e, --env <value>',
      'add or override container environment variables',
      (e, collected) => {
        const [k, v] = e.split('=');
        return collected.concat([
          {
            name: k,
            value: v,
          },
        ]);
      },
      [],
    )
    .action(async (cmd) => {
      const cfnStackName = cmd.getCfnStackName();
      const { appOnlyTaskDefName, clusterName, serviceName } =
        await aws.getCfnStackExports(cfnStackName);

      // check that we're not using a wildly different version of the cli
      if (!this.yes && !(await cmd.stackVersionDiffCheck())) {
        exitWithSuccess();
      }
      if (!(await confirmProductionOp(cmd.yes))) {
        exitWithSuccess();
      }

      console.log(
        `Running command '${cmd.command}' on service ${serviceName} using task def ${appOnlyTaskDefName}`,
      );
      const taskArn = await aws.execTask({
        clusterName,
        serviceName,
        taskDefName: appOnlyTaskDefName,
        command: cmd.command,
        environment: cmd.env,
      });
      exitWithSuccess(`Task ${taskArn} started`);
    });

  cli
    .command('connect')
    .description("connect to an app's peripheral services (db, redis, etc)")
    .appOption()
    .option('-l, --list', 'list the things to connect to')
    .option(
      '-s, --service <string>',
      'service to connect to; defaults to the only one if the app has just one; use `--list` to see what is available',
    )
    .option(
      '--local-port <string>',
      'attach tunnel to a non-default local port',
    )
    .option(
      '--ttl <number>',
      'ephemeral bastion time-to-live in seconds; defaults to the launcher setting (3600, max 86400)',
    )
    .option(
      '--print-only',
      'dry run; print the commands that would launch a bastion and open the tunnel, without running them',
    )
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig();

      const services = new Set();
      ['dbOptions', 'cacheOptions'].forEach((optsKey) => {
        if (deployConfig[optsKey]) {
          services.add(deployConfig[optsKey].engine);
        }
      });
      if (yn(deployConfig.docDb)) {
        exitWithError(
          [
            'Deployment configuration is out-of-date',
            'Replace `docDb*` with `dbOptions: {...}`',
          ].join('\n'),
        );
      }

      if (cmd.list) {
        exitWithSuccess(
          ['Valid `--service=` options:', ...services].join('\n  '),
        );
      }

      let { service } = cmd;
      if (!service) {
        if (services.size !== 1) {
          exitWithError(
            services.size === 0
              ? `${cmd.app} has no connectable services`
              : 'One of `--list` or `--service` is required',
          );
        }
        [service] = services;
        console.log(`connecting to ${service}`);
      } else if (!services.has(service)) {
        exitWithError(`'${service}' is not a valid option`);
      }

      const cfnStackName = cmd.getCfnStackName();
      const cfnStackExports = await aws.getCfnStackExports(cfnStackName);

      let endpoint;
      let localPort;
      let clientCommand;

      if (['mysql', 'docdb'].includes(service)) {
        endpoint = cfnStackExports.dbClusterEndpoint;
        const { dbPasswordSecretArn } = cfnStackExports;
        if (endpoint === undefined || dbPasswordSecretArn === undefined) {
          exitWithError(
            `Stack ${cfnStackName} is missing its db exports; has it been deployed?`,
          );
        }
        const password = await aws.resolveSecret(dbPasswordSecretArn);
        if (service === 'mysql') {
          localPort = cmd.localPort || '3306';
          clientCommand = `mysql -uroot -p${password} --port ${localPort} -h 127.0.0.1`;
        } else {
          localPort = cmd.localPort || '27017';
          const tlsOpts =
            '--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates';
          clientCommand = `mongo ${tlsOpts} --username root --password ${password} --port ${localPort}`;
        }
      } else if (service === 'redis') {
        endpoint = cfnStackExports.cacheEndpoint;
        if (endpoint === undefined) {
          exitWithError(
            `Stack ${cfnStackName} is missing its cache endpoint export; has it been deployed?`,
          );
        }
        localPort = cmd.localPort || '6379';
        clientCommand = `redis-cli -p ${localPort}`;
      } else {
        exitWithError(`not sure what to do with ${service}`);
      }

      const [remoteHost, remotePort] = endpoint.split(':');

      if (
        !/^\d+$/.test(String(localPort)) ||
        Number(localPort) < 1 ||
        Number(localPort) > 65535
      ) {
        exitWithError(`'${localPort}' is not a valid local port`);
      }

      if (!cmd.printOnly && !(await localPortIsFree(Number(localPort)))) {
        exitWithError(
          `local port ${localPort} is in use; choose another with --local-port`,
        );
      }

      if (
        cmd.ttl !== undefined &&
        (!/^[1-9]\d*$/.test(String(cmd.ttl)) || Number(cmd.ttl) > 86400)
      ) {
        exitWithError(
          `'${cmd.ttl}' is not a valid ttl; provide a positive number of seconds, up to 86400 (24 hours)`,
        );
      }

      const buildSessionArgs = (instanceId) => {
        const args = [
          'ssm',
          'start-session',
          '--target',
          instanceId,
          '--document-name',
          SSM_PORT_FORWARDING_DOCUMENT,
          '--parameters',
          JSON.stringify({
            host: [remoteHost],
            portNumber: [String(remotePort)],
            localPortNumber: [String(localPort)],
          }),
        ];
        if (cmd.profile !== undefined) {
          args.push('--profile', cmd.profile);
        }
        return args;
      };

      if (cmd.printOnly) {
        const invokeArgs = [
          'lambda',
          'invoke',
          '--function-name',
          aws.BASTION_LAUNCHER_FUNCTION_NAME,
          '--payload',
          JSON.stringify({
            appName: cmd.app,
            ...(cmd.ttl ? { ttlSeconds: Number(cmd.ttl) } : {}),
          }),
        ];
        if (getAwsCliMajorVersion() >= 2) {
          invokeArgs.push('--cli-binary-format', 'raw-in-base64-out');
        }
        const waitArgs = [
          'ssm',
          'describe-instance-information',
          '--filters',
          `Key=InstanceIds,Values=${INSTANCE_ID_VAR}`,
          '--query',
          'InstanceInformationList[0].PingStatus',
          '--output',
          'text',
        ];
        if (cmd.profile !== undefined) {
          invokeArgs.push('--profile', cmd.profile);
          waitArgs.push('--profile', cmd.profile);
        }
        invokeArgs.push(BASTION_RESPONSE_FILE);

        exitWithSuccess(
          [
            'Nothing was launched. Run the following to connect by hand (requires jq):',
            '',
            '# 1. launch an ephemeral bastion and capture its instance id',
            printableAwsCommand(invokeArgs),
            `INSTANCE_ID=$(jq -r '.body | fromjson | .instanceId' ${BASTION_RESPONSE_FILE})`,
            '',
            '# 2. repeat until this prints "Online" (usually under a minute)',
            printableAwsCommand(waitArgs),
            '',
            '# 3. open the tunnel; leave it running',
            printableAwsCommand(buildSessionArgs(INSTANCE_ID_VAR)),
            '',
            `# 4. connect with a ${service} client`,
            clientCommand,
          ].join('\n'),
        );
      }

      console.log(`Requesting ephemeral bastion for ${cmd.app}...`);
      let bastion;
      try {
        bastion = await aws.invokeBastionLauncher({
          appName: cmd.app,
          ttlSeconds: cmd.ttl ? Number(cmd.ttl) : undefined,
        });
      } catch (err) {
        exitWithError(err.message);
      }
      console.log(`Launched bastion ${bastion.instanceId}`);

      try {
        await aws.waitForInstanceSsmOnline(bastion.instanceId, {
          onTick: (elapsed) => {
            console.log(
              `waiting for the bastion's SSM agent to come online (${elapsed}s elapsed); a new instance can take 1-2 minutes...`,
            );
          },
        });
      } catch (err) {
        exitWithError(err.message);
      }

      const sessionArgs = buildSessionArgs(bastion.instanceId);

      /**
       * `detached: true` gives the aws cli its own process group so that
       * killing the group also kills the session-manager-plugin process it
       * spawns; killing just the aws process orphans the plugin and leaves
       * the tunnel open
       */
      const child = spawn('aws', sessionArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, AWS_REGION: aws.getCurrentRegion() },
        detached: true,
      });

      const killTunnelProcessGroup = (signal) => {
        try {
          process.kill(-child.pid, signal);
        } catch (err) {
          // group already gone or not yet created; fall back to the child
          child.kill(signal);
        }
      };

      let childOutput = '';
      child.stdout.on('data', (data) => {
        childOutput += data;
      });
      child.stderr.on('data', (data) => {
        childOutput += data;
      });

      child.on('error', (err) => {
        if (err.code === 'ENOENT') {
          exitWithError(
            'The `aws` cli was not found; it (and the session-manager-plugin) are required for the port-forwarding session',
          );
        }
        exitWithError(err.message);
      });

      let tunnelUp = false;
      let userExit = false;

      child.on('exit', () => {
        if (userExit) return;
        if (!tunnelUp) {
          let hint = '';
          if (childOutput.includes('SessionManagerPlugin is not found')) {
            hint =
              'The session-manager-plugin is required. See https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html';
          } else if (childOutput.includes('TargetNotConnected')) {
            hint =
              'The bastion was not ready to accept a session; try re-running this command';
          } else if (childOutput.includes('AccessDenied')) {
            hint =
              'You may need the TempBastionUserAccess IAM policy attached to your user/role';
          }
          exitWithError(
            [
              'The port-forwarding session failed to start:',
              childOutput.trim(),
              hint,
            ]
              .filter(Boolean)
              .join('\n'),
          );
        }
        console.log(
          '\nThe tunnel closed unexpectedly; the bastion may have reached its TTL,\nor the SSM session hit the account idle-session timeout.\nRe-run `caccl-deploy connect` to establish a new tunnel.',
        );
        process.exit(1);
      });

      try {
        await waitForLocalPortOpen(Number(localPort), { timeoutSeconds: 60 });
      } catch (err) {
        killTunnelProcessGroup('SIGTERM');
        exitWithError(err.message);
      }
      tunnelUp = true;

      console.log(
        [
          '',
          'Tunnel is up!',
          '',
          `# ${service} client command:\n${clientCommand}`,
          '',
          `The bastion expires at ${bastion.expiresAt}`,
          'Press Ctrl-C to close the tunnel',
        ].join('\n'),
      );

      const closeTunnel = () => {
        userExit = true;
        console.log('\nclosing tunnel...');
        const forceKill = setTimeout(() => {
          killTunnelProcessGroup('SIGKILL');
        }, 5000);
        child.once('exit', () => {
          clearTimeout(forceKill);
          process.exit(0);
        });
        killTunnelProcessGroup('SIGTERM');
      };
      process.on('SIGINT', closeTunnel);
      process.on('SIGTERM', closeTunnel);
    });

  cli
    .command('schedule')
    .description(
      'create a scheduled task that executes the app image with a custom command',
    )
    .appOption()
    .option('-l, --list', 'list the existing scheduled tasks')
    .option(
      '-t, --task-id <string>',
      'give the taska a string id; by default one will be generated',
    )
    .option(
      '-d, --task-description <string>',
      'description of what the task does',
    )
    .option('-D, --delete <string>', 'delete a scheduled task')
    .option(
      '-s, --task-schedule <string>',
      'a cron expression, e.g. "0 4 * * *"',
    )
    .option('-c, --task-command <string>', 'the app task command to run')
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig();
      const existingTasks = deployConfig.scheduledTasks || {};
      const existingTaskIds = Object.keys(existingTasks);

      if (cmd.list) {
        // format existing as a table and exitWithSuccess
        if (existingTaskIds.length) {
          const tableRows = existingTaskIds.map((id) => {
            const taskSettings = existingTasks[id];
            const { command, schedule, description } = taskSettings;
            return [id, schedule, command, description];
          });
          const tableOutput = table([
            ['ID', 'Schedule', 'Command', 'Description'],
            ...tableRows,
          ]);
          exitWithSuccess(tableOutput);
        }
        exitWithSuccess('No scheduled tasks configured');
      } else if (cmd.delete) {
        // delete the existing entry
        if (!existingTaskIds.includes(cmd.delete)) {
          exitWithError(`No scheduled task with id ${cmd.delete}`);
        }
        const existingTask = existingTasks[cmd.delete];
        if (
          !(cmd.yes || (await confirm(`Delete scheduled task ${cmd.delete}?`)))
        ) {
          exitWithSuccess();
        }
        const existingTaskParams = Object.keys(existingTask);
        for (let i = 0; i < existingTaskParams.length; i++) {
          await deployConfig.delete(
            cmd.getAppPrefix(),
            `scheduledTasks/${cmd.delete}/${existingTaskParams[i]}`,
          );
        }
        exitWithSuccess(`Scheduled task ${cmd.delete} deleted`);
      } else if (!(cmd.taskSchedule && cmd.taskCommand)) {
        exitWithError('Invalid options. See `--help` output');
      }

      const taskId = cmd.taskId || Math.random().toString(36).substr(2, 16);
      const taskDescription = cmd.taskDescription || '';
      const { taskSchedule } = cmd;
      const taskComman = cmd.taskCommand;

      if (!validSSMParamName(taskId)) {
        exitWithError(
          `Invalid ${taskId} value; '/^([a-z0-9:/_-]+)$/i' allowed only`,
        );
      }

      if (
        existingTaskIds.some((t) => {
          return t.id === taskId;
        })
      ) {
        exitWithError(
          `A schedule task with id ${taskId} already exists for ${cmd.app}`,
        );
      }

      const params = {
        [`scheduledTasks/${taskId}/description`]: taskDescription,
        [`scheduledTasks/${taskId}/schedule`]: taskSchedule,
        [`scheduledTasks/${taskId}/command`]: taskComman,
      };

      await deployConfig.syncToSsm(cmd.getAppPrefix(), params);
      exitWithSuccess('task scheduled');
    });

  await cli.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
