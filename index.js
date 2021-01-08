#!/usr/bin/env node

const { Command } = require('commander');
const { execSync } = require('child_process');
const { table } = require('table');
const path = require('path');
const moment = require('moment');
const chalk = require('chalk');
const figlet = require('figlet');
const yn = require('yn');
const tempy = require('tempy');

const aws = require('./lib/aws');
const DeployConfig = require('./lib/deployConfig');
const cacclDeployVersion = require('./lib/generateVersion')();
const {
  promptAppName,
  confirm,
  confirmProductionOp,
} = require('./lib/configPrompts');
const { conf, setConfigDefaults, configDefaults } = require('./lib/conf');
const { description } = require('./package.json');
const { looksLikeSemver, validSSMParamName } = require('./lib/helpers');
const {
  AppNotFound,
  UserCancel,
  AwsProfileNotFound,
  NoPromptChoices,
  CfnStackNotFound,
} = require('./lib/errors');

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
  exitWithError([
    'Looks like there is a problem with your AWS credentials configuration.',
    'Did you run `aws configure`? Did you set a region? Default profile?',
  ].join('\n'));
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
    if (this.ssmRootPrefix === undefined
        || (this.app === undefined && appName === undefined)) {
      throw Error('Attempted to make an ssm prefix with undefined values');
    }
    return `${this.ssmRootPrefix}/${appName || this.app}`;
  }

  /**
   * Convenience method for getting the name of the app's CloudFormation stack
   * @param {string} appName
   */
  getCfnStackName(appName) {
    if (this.cfnStackPrefix === undefined
      || (this.app === undefined && appName === undefined)) {
      throw Error('Attempted to make a cloudformation stack name with undefined values');
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
        keepSecretArns
      );
      return deployConfig;
    } catch (err) {
      if (err instanceof AppNotFound) {
        exitWithError(`${this.app} app configuration not found!`);
      }
    }
  }

  /**
   * For assigning some common options to all commands
   *
   * @return {CacclDeployCommander}
   * @memberof CacclDeployCommander
   */
  commonOptions() {
    return this
      .option(
        '--profile <string>',
        'activate a specific aws config/credential profile',
        initAwsProfile
      )
      .option(
        '--ecr-access-role-arn <string>',
        'IAM role ARN for cross account ECR repo access',
        conf.get('ecrAccessRoleArn')
      )
      .requiredOption(
        '--ssm-root-prefix <string>',
        'The root prefix for ssm parameter store entries',
        conf.get('ssmRootPrefix')
      )
      .requiredOption(
        '--cfn-stack-prefix <string>',
        'cloudformation stack name prefix, e.g. "CacclDeploy-"',
        conf.get('cfnStackPrefix')
      )
      .option(
        '-y --yes',
        'non-interactive, yes to everything, overwrite existing, etc',
        yn(CACCL_DEPLOY_NON_INTERACTIVE)
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
    const args = [
      '-a --app <string>',
      'name of the app to work with',
    ];
    return (optional
      ? this.option(...args)
      : this.requiredOption(...args));
  }
}

async function main() {
  // confirm ASAP that the user's AWS creds/config is good to go
  if (!aws.isConfigured()) {
    byeWithCredentialsError();
  }

  /*
   * check if this is the first time running and if so create the
   * config file with defaults
   */
  if (!conf.get('ssmRootPrefix')) {
    console.log(chalk.greenBright(figlet.textSync('Caccl-Deploy!')));
    console.log([
      'It looks like this is your first time running caccl-deploy. ',
      `A preferences file has been created at ${chalk.yellow(conf.path)}`,
      'with the following default values:',
      '',
      ...Object.entries(configDefaults).map(([k, v]) => {
        return `  - ${chalk.yellow(k)}: ${chalk.bold(v)}`;
      }),
      '',
      'Please see the docs for explanations of these settings',
    ].join('\n'));

    CACCL_DEPLOY_NON_INTERACTIVE || (await confirm('Continue?', true)) || exitWithSuccess();
    setConfigDefaults();
  }

  const cli = new CacclDeployCommander()
    .version(cacclDeployVersion)
    .description([
      description,
      `config: ${conf.path}`,
    ].join('\n'));

  cli
    .command('apps')
    .option(
      '--full-status',
      'show the full status of each app including CFN stack and config state'
    )
    .description('list available app configurations')
    .action(async (cmd) => {
      const apps = await aws.getAppList(cmd.ssmRootPrefix);

      if (!apps.length) {
        exitWithError(`No app configurations found using ssm root prefix ${cmd.ssmRootPrefix}`);
      }

      const appData = {};
      const tableColumns = ['App'];

      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        appData[app] = [];
      }

      if (cmd.fullStatus) {
        tableColumns.push('Infra Stack', 'Stack Status', 'Config Drift');
        const cfnStacks = await aws.getCfnStacks(cmd.cfnStackPrefix);

        for (let i = 0; i < apps.length; i++) {
          const app = apps[i];
          const cfnStackName = cmd.getCfnStackName(app);

          const appPrefix = cmd.getAppPrefix(app);
          const deployConfig = await DeployConfig
            .fromSsmParams(appPrefix);
          appData[app].push(deployConfig.infraStackName);

          const cfnStack = cfnStacks.find((s) => {
            return s.StackName === cfnStackName && s.StackStatus !== 'DELETE_COMPLETE';
          });
          if (!cfnStack) {
            // config exists but cfn stack not deployed yet (or was destroyed)
            appData[app].push('', '');
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
        }
      }
      const tableData = Object.keys(appData).map((app) => {
        return [app, ...appData[app]];
      });

      exitWithSuccess(
        table([tableColumns, ...tableData])
      );
    });

  cli
    .command('new')
    .description('create a new app deploy config via import and/or prompts')
    .appOption(true)
    .option(
      '-i --import <string>',
      'import new deploy config from a json file or URL'
    )
    .description('create a new app configuration')
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const existingApps = await aws.getAppList(cmd.ssmRootPrefix);

      let appName;
      try {
        appName = (cmd.app || await promptAppName());
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

        if (cmd.yes || await confirm('Overwrite?')) {
          if (!await confirmProductionOp(cmd.yes)) {
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
        importedConfig = (/^http(s):\//.test(cmd.import))
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
          exitWithError([
            'Something went wrong trying to generate your config: ',
            err.message,
          ].join('\n'));
        }
        throw err;
      }

      await deployConfig.syncToSsm(appPrefix);
      exitWithSuccess([
        chalk.yellowBright(figlet.textSync(`${appName}!`)),
        '',
        'Your new app deployment configuration is created!',
        'Next steps:',
        `  * modify or add settings with 'caccl-deploy update -a ${appName} [...]'`,
        `  * deploy the app stack with 'caccl-deploy stack -a ${appName} deploy'`,
        '',
      ].join('\n'));
    });

  cli
    .command('delete')
    .description('delete an app configuration')
    .appOption()
    .action(async (cmd) => {
      const cfnStackName = cmd.getCfnStackName();
      if (await aws.cfnStackExists(cfnStackName)) {
        exitWithError([
          `You must first run "caccl-deploy stack -a ${cmd.app} destroy" to delete`,
          `the deployed ${cfnStackName} CloudFormation stack before deleting it's config.`,
        ].join('\n'));
      }

      try {
        console.log(`This will delete all deployment configuation for ${cmd.app}`);

        if (!(cmd.yes || await confirm('Are you sure?'))) {
          exitWithSuccess();
        }
        // extra confirm if this is a production deployment
        if (!await confirmProductionOp(cmd.yes)) {
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
    .description('display an app\'s current configuration')
    .appOption()
    .option(
      '-f --flat',
      'display the flattened, key: value form of the config'
    )
    .option(
      '-s --sha',
      'output a sha1 hash of the current configuration'
    )
    .option(
      '--keep-secret-arns',
      'show app environment secret value ARNs instead of dereferencing'
    )
    .action(async (cmd) => {
      // we only want to see that sha1 hash (likely for debugging)
      if (cmd.sha) {
        exitWithSuccess((await cmd.getDeployConfig()).toHash());
      }
      exitWithSuccess(
        (await cmd.getDeployConfig(cmd.keepSecretArns)).toString(true, cmd.flat)
      );
    });

  cli
    .command('update')
    .description('update (or delete) a single deploy config setting')
    .appOption()
    .option(
      '-D --delete',
      'delete the named parameter instead of creating/updating'
    )
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig(true);

      if (!await confirmProductionOp(cmd.yes)) {
        exitWithSuccess();
      }

      try {
        if (cmd.args.length > 2) {
          exitWithError('Too many arguments!');
        }
        if (cmd.delete) {
          const [param] = cmd.args;
          await deployConfig.delete(
            cmd.getAppPrefix(),
            param
          );
        } else {
          const [param, value] = cmd.args;
          if (!validSSMParamName(param)) {
            throw new Error(`Invalid param name: '${param}'`);
          }
          await deployConfig.update(
            cmd.getAppPrefix(),
            param,
            value
          );
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
      const data = repos.map((r) => { return [r]; });

      if (data.length) {
        const tableOutput = table([
          ['Respository Name'],
          ...data,
        ]);
        exitWithSuccess(tableOutput);
      }
      exitWithError('No ECR repositories found');
    });

  cli
    .command('images')
    .description('list the most recent available ECR images for an app')
    .requiredOption(
      '-r --repo <string>',
      'the name of the ECR repo; use `caccl-deploy app repos` for available repos'
    )
    .option(
      '-A --all',
      'show all images; default is to show only semver-tagged releases'
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
        const imageArns = i.imageTags.reduce((collect, t) => {
          if (includeThisTag(t)) {
            collect.push(
              aws.createEcrArn({
                repoName: cmd.repo,
                imageTag: t,
                account: i.registryId,
                region,
              })
            );
          }
          return collect;
        }, []).join('\n');

        return [
          moment(i.imagePushedAt).format(),
          imageTags,
          imageArns,
        ];
      });
      if (data.length) {
        const tableOutput = table([
          ['Pushed On', 'Tags', 'ARNs'],
          ...data,
        ]);
        exitWithSuccess(tableOutput);
      }
      exitWithError('No images found');
    });

  cli
    .command('stack')
    .description('diff, deploy, or delete the app\'s AWS resources')
    .appOption()
    .action(async (cmd) => {
      // get this without resolved secrets for passing to cdk
      const deployConfig = await cmd.getDeployConfig(true);

      // get it again with resolved secrets so we can make our hash
      const deployConfigHash = (await cmd.getDeployConfig()).toHash();

      /**
       * Get the important ids/names from our infrastructure stack:
       *   - id of the vpc
       *   - name of the ECS cluster
       *   - name of the S3 bucket where the load balancer will send logs
       */
      const cfnStackName = cmd.getCfnStackName();
      const {
        vpcId,
        ecsClusterName,
        albLogBucketName,
      } = await aws.getCfnStackExports(deployConfig.infraStackName);

      /**
       * Create an object structure with all the info
       * the CDK stack operation will need
       */
      const cdkStackProps = {
        vpcId,
        ecsClusterName,
        albLogBucketName,
        cacclDeployVersion,
        deployConfigHash,
        stackName: cfnStackName,
        awsAccountId: await aws.getAccountId(),
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        deployConfig,
      };

      /**
       * Write out the stack properties to a temp json file for
       * the CDK subprocess to pick up
       */
      tempy.write.task(JSON.stringify(cdkStackProps), async (tempPath) => {
        const envAdditions = {
          AWS_REGION: process.env.AWS_REGION || 'us-east-1',
          // tell the CDK subprocess where to find the stack properties file
          CDK_STACK_PROPS_FILE_PATH: tempPath,
        };

        // all args/options following the `stack` subcommand get passed to cdk
        const cdkArgs = [...cmd.args];

        // default cdk operation is `list`
        if (!cdkArgs.length) {
          cdkArgs.push('list');
        }

        // tell cdk to use the same profile
        if (cmd.profile !== undefined) {
          cdkArgs.push('--profile', cmd.profile);
          envAdditions.AWS_PROFILE = cmd.profile;
        }

        // disable cdk prompting if user included `--yes` flag
        if (cdkArgs[0] === 'deploy' && cmd.yes) {
          cdkArgs.push('--require-approval-never');
        }

        // production failsafe if we're actually changing anything
        if (cdkArgs.includes('deploy') || cdkArgs.includes('destroy')) {
          if (!await confirmProductionOp(cmd.yes)) {
            exitWithSuccess();
          }
        }

        const execOpts = {
          stdio: 'inherit',
          // exec the cdk process in the cdk directory
          cwd: path.join(__dirname, 'cdk'),
          // inject our additional env vars
          env: { ...process.env, ...envAdditions },
        };

        try {
          execSync(['npx cdk', ...cdkArgs].join(' '), execOpts);
        } catch (err) {
          console.error(err);
        }
      });
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
      console.log(`Restarting service ${serviceName} on cluster ${clusterName}`);

      if (!await confirmProductionOp(cmd.yes)) {
        exitWithSuccess();
      }

      // restart the service
      await aws.restartEcsServcie(clusterName, serviceName, true);
      exitWithSuccess('done');
    });

  cli
    .command('release')
    .description('release a new version of an app')
    .appOption()
    .requiredOption(
      '-i --image-tag <string>',
      'the docker image version tag to release'
    )
    .option(
      '--no-deploy',
      'Update the Fargate Task Definition but don\' restart the service'
    )
    .action(async (cmd) => {
      // see the README section on cross-account ECR access
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }

      const deployConfig = await cmd.getDeployConfig();

      const cfnStackName = cmd.getCfnStackName();
      let cfnExports;
      try {
        cfnExports = await aws.getCfnStackExports(cfnStackName);
        [
          'taskDefName',
          'clusterName',
          'serviceName',
        ].forEach((exportValue) => {
          if (cfnExports[exportValue] === undefined) {
            throw new Error(`Incomplete app stack: missing ${exportValue}`);
          }
        });
      } catch (err) {
        if (err instanceof CfnStackNotFound || err.message.includes('Incomplete')) {
          exitWithError(err.message);
        }
        throw err;
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
        cmd.imageTag
      );
      if (!imageTagExists) {
        exitWithError(`No image with tag ${cmd.imageTag} in ${repoArn.repoName}`);
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

      const { taskDefName, clusterName, serviceName } = cfnExports;

      if (!await confirmProductionOp(cmd.yes)) {
        exitWithSuccess();
      }

      // create a new version of the taskdef with the updated image
      console.log(`Updating ${cmd.app} task definition to use ${newAppImage}`);
      await aws.updateTaskDefAppImage(taskDefName, newAppImage);

      // update the ssm parameter
      console.log('Updating stored deployment configuration');
      await deployConfig.update(cmd.getAppPrefix(), 'appImage', newAppImage);

      // restart the service
      if (cmd.deploy) {
        console.log(`Restarting the ${serviceName} service...`);
        await aws.restartEcsServcie(clusterName, serviceName, true);
        exitWithSuccess('done.');
      }
      exitWithSuccess([
        'Redployment skipped',
        'WARNING: service is out-of-sync with stored deployment configuration',
      ].join('\n'));
    });
  await cli.parseAsync(process.argv);
}

main()
  .catch((err) => {
    console.error(err);
  });
