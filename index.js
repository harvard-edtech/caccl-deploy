#!/usr/bin/env node

const { Command } = require('commander');
const { spawnSync } = require('child_process');
const { table } = require('table');
const path = require('path');
const moment = require('moment');
const chalk = require('chalk');
const figlet = require('figlet');
const aws = require('./lib/aws');
const { promptAppName, confirm } = require('./lib/configPrompts');
const { conf, setConfigDefaults, configDefaults } = require('./lib/conf');
const DeployConfig = require('./lib/deployConfig');
const { description } = require('./package.json');
const { looksLikeSemver } = require('./lib/helpers');

const cacclDeployVersion = require('./lib/generateVersion')();

const initAwsProfile = (profile) => {
  try {
    aws.initProfile(profile);
  } catch (err) {
    console.log(err);
    return err;
  }
};

class CacclDeployCommander extends Command {
  createCommand(name) {
    const cmd = new CacclDeployCommander(name)
      .storeOptionsAsProperties()
      .commonOptions()
      .passCommandToAction();
    return cmd;
  }

  getAppPrefix(appName) {
    const options = this.opts();
    if (options.ssmRootPrefix === undefined
      || (options.app === undefined && appName === undefined)) {
      throw Error('Attempted to make an ssm prefix with undefined values');
    }
    return `${options.ssmRootPrefix}/${appName !== undefined ? appName : options.app}`;
  }

  getSsmParameterName(configName, appName) {
    return `${this.getAppPrefix(appName)}/${configName}`;
  }

  getCfnStackName(appName) {
    const options = this.opts();
    if (options.cfnStackPrefix === undefined
      || (options.app === undefined && appName === undefined)) {
      throw Error('Attempted to make a cloudformation stack name with undefined values');
    }
    return `${options.cfnStackPrefix}${appName !== undefined ? appName : options.app}`;
  }

  async getDeployConfig(resolveSecrets = true) {
    const appPrefix = this.getAppPrefix();
    try {
      const deployConfig = await DeployConfig.fromSsmParams(
        appPrefix,
        resolveSecrets
      );
      return deployConfig;
    } catch (err) {
      if (err.name === 'AppNotFound') {
        console.log(`${this.app} configuration not found!`);
        process.exit(1);
      }
    }
  }

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
      );
  }

  appOption(required = true) {
    const args = [
      '-a --app <string>',
      'name of the app to work with',
    ];
    return required
      ? this.requiredOption(...args)
      : this.option(...args);
  }
}

async function main() {
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
    if (!await confirm('Continue')) {
      process.exit(0);
    }
    setConfigDefaults();
  }

  const cli = new CacclDeployCommander()
    .version(cacclDeployVersion)
    .description(description);

  cli
    .command('apps')
    .description('list available app configurations')
    .action(async (cmd) => {
      const apps = await aws.getAppList(cmd.ssmRootPrefix);
      const tableData = apps.map((a) => {
        return [a];
      });
      console.log(apps.length
        ? table([['App'], ...tableData])
        : `No app configurations found using ssm root prefix ${cmd.ssmRootPrefix}`);
    });

  cli
    .command('new')
    .description('create a new app deploy config via import and/or prompts')
    .appOption(false)
    .option('-i --import <string>',
      'import new deploy config from a json file or URL')
    .option('-F --force',
      'non-interactive, yes to everything, overwrite existing, etc')
    .description('create a new app configuration')
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const existingApps = await aws.getAppList(cmd.ssmRootPrefix);

      const appName = (cmd.app === undefined)
        ? await promptAppName()
        : cmd.app;

      const appPrefix = cmd.getAppPrefix(appName);

      if (existingApps.includes(appName)) {
        console.log(`Configuration for ${cmd.app} already exists`);
        if (cmd.force || await confirm('Overwrite?', false)) {
          await DeployConfig.wipeExisting(appPrefix);
        } else {
          console.log('Bye!');
          process.exit();
        }
      }

      let importedConfig;
      if (cmd.import !== undefined) {
        importedConfig = (/^http(s):\//.test(cmd.import))
          ? await DeployConfig.fromUrl(cmd.import)
          : DeployConfig.fromFile(cmd.import);
      }

      const deployConfig = await DeployConfig.generate(importedConfig);

      await deployConfig.syncToSsm(appPrefix);
    });

  cli
    .command('delete')
    .description('delete an app configuration')
    .appOption()
    .action(async (cmd) => {
      const appPrefix = cmd.getAppPrefix();

      try {
        console.log(`This will delete all deployment configuation for ${cmd.app}`);
        if (await confirm('Are you sure?')) {
          await DeployConfig.wipeExisting(appPrefix, false);
          console.log(`${cmd.app} configuration deleted`);
        }
      } catch (err) {
        if (err.name === 'AppNotFound') {
          console.log(`${cmd.app} configuration not found!`);
          process.exit(1);
        }
      }
    });

  cli
    .command('show')
    .description('display an app\'s current configuration')
    .appOption()
    .option('-f --flat',
      'display the flattened, key: value form of the config')
    .option('--no-resolve-secrets',
      'show app environment secret value ARNs instead of dereferencing')
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig(cmd.resolveSecrets);
      console.log(deployConfig.toString(true, cmd.flat));
    });

  cli
    .command('update')
    .description('update (or delete) a single deploy config setting')
    .appOption()
    .option('-D --delete',
      'delete the named parameter instead of creating/updating')
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig();
      if (cmd.delete) {
        const [param] = cmd.args;
        const paramPath = [cmd.getAppPrefix(), param].join('/');
        await aws.deleteSsmParameters([paramPath]);
      } else {
        const [param, value] = cmd.args;
        await deployConfig.update(
          cmd.getAppPrefix(),
          param,
          value
        );
      }
    });

  cli
    .command('repos')
    .description('list the available ECR repositories')
    .action(async (cmd) => {
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
        console.log(tableOutput);
      } else {
        console.log('No ECR repositories found');
      }
    });

  cli
    .command('images')
    .description('list the most recent available ECR images for an app')
    .requiredOption('-r --repo <string>',
      'the name of the ECR repo; use `caccl-deploy app repos` for available repos')
    .option('-A --all',
      'show all images; default is to show only semver-tagged releases')
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const images = await aws.getRepoImageList(cmd.repo, cmd.all);
      const account = await aws.getAccountId();
      const region = aws.getCurrentRegion();
      const data = images.map((i) => {
        const imageTags = i.imageTags.filter((t) => {
          return cmd.all || looksLikeSemver(t);
        }).join('\n');

        const imageArns = i.imageTags.reduce((collect, t) => {
          if (cmd.all || looksLikeSemver(t)) {
            collect.push(
              aws.createEcrArn({
                repoName: cmd.repo,
                imageTag: t,
                account,
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
        console.log(tableOutput);
      } else {
        console.log('No images found');
      }
    });

  cli
    .command('stack')
    .description('diff, deploy, update or delete the app\'s AWS resources')
    .appOption()
    .option('-F --force',
      'non-interactive, yes to everything, overwrite existing, etc')
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig();
      const cfnStackName = cmd.getCfnStackName();
      const {
        vpcId,
        ecsClusterName,
      } = await aws.getCfnStackExports(deployConfig.infraStackName);

      const cdkArgs = [...cmd.args];
      if (!cdkArgs.length) {
        cdkArgs.push('list');
      }

      if (cmd.profile !== undefined) {
        cdkArgs.push('--profile', cmd.profile);
      }

      if (cdkArgs[0] === 'deploy' && cmd.force) {
        cdkArgs.push('--require-approval-never');
      }

      const envAdditions = {};
      envAdditions.CACCL_DEPLOY_VERSION = cacclDeployVersion;
      envAdditions.CACCL_DEPLOY_SSM_APP_PREFIX = cmd.getAppPrefix();
      envAdditions.CACCL_DEPLOY_STACK_NAME = cfnStackName;
      envAdditions.CACCL_DEPLOY_VPC_ID = vpcId;
      envAdditions.CACCL_DEPLOY_ECS_CLUSTER = ecsClusterName;
      envAdditions.AWS_ACCOUNT_ID = await aws.getAccountId();
      envAdditions.AWS_REGION = process.env.AWS_REGION || 'us-east-1';

      const execOpts = {
        stdio: 'inherit',
        cwd: path.join(__dirname, 'cdk'),
        env: { ...process.env, ...envAdditions },
      };

      try {
        spawnSync('cdk', cdkArgs, execOpts);
      } catch (err) {
        console.error(err);
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
        if (err.name === 'CfnStackNotFound') {
          console.log(err.message);
        }
        process.exit(1);
      }
      const { clusterName, serviceName } = cfnExports;
      // restartthe service
      await aws.restartEcsServcie(clusterName, serviceName);
    });

  cli
    .command('release')
    .description('release a new version of an app')
    .appOption()
    .requiredOption('-i --image-tag <string>',
      'the docker image version tag to release')
    .option('-f --force',
      'just do it; no confirmations or prompts')
    .option('--no-deploy',
      'Update the Fargate Task Definition but don\' restart the service')
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }

      const deployConfig = await cmd.getDeployConfig();

      const cfnStackName = cmd.getCfnStackName();
      let cfnExports;
      try {
        cfnExports = await aws.getCfnStackExports(cfnStackName);
      } catch (err) {
        if (err.name === 'CfnStackNotFound') {
          console.log(err.message);
        }
        process.exit(1);
      }

      /**
       * caccl-deploy allows non-ECR images, but in the `caccl-deploy` context
       * we can assume that `appImage` will be an ECR repo ARN
       */
      const repoArn = aws.parseEcrArn(deployConfig.appImage);

      // check that the specified image tag is legit
      console.log(`Checking that an image exists with the tag ${cmd.imageTag}`);
      const imageTagExists = await aws.imageTagExists(
        repoArn.repoName,
        cmd.imageTag
      );
      if (!imageTagExists) {
        console.log(`No image with tag ${cmd.imageTag} in ${repoArn.repoName}`);
        process.exit(1);
      }

      // check if it's the latest release and prompt if not
      console.log(`Checking ${cmd.imageTag} is the latest tag`);
      const isLatestTag = await aws.isLatestTag(repoArn.repoName, cmd.imageTag);
      if (!isLatestTag && !cmd.force) {
        console.log(`${cmd.imageTag} is not the most recent release`);
        if (!await confirm('Proceed?')) {
          process.exit();
        }
      }

      // generate the new repo image arn to be deployed
      const newAppImage = aws.createEcrArn({
        ...repoArn,
        imageTag: cmd.imageTag,
      });

      const { taskDefName, clusterName, serviceName } = cfnExports;

      console.log(`Updating ${cmd.appName} task to use ${newAppImage}`);
      await aws.updateTaskDefAppImage(taskDefName, newAppImage);

      // update the ssm parameter
      console.log('Updating stored deployment configuration');
      await deployConfig.update(cmd.getAppPrefix(), 'appImage', newAppImage);

      // restart the service
      if (cmd.deploy) {
        console.log(`Restarting the ${serviceName} service...`);
        await aws.restartEcsServcie(clusterName, serviceName);
      } else {
        console.log('Redployment skipped');
        console.log('WARNING: service is out-of-sync with stored deployment configuration');
      }
    });
  await cli.parse(process.argv);
}

main().catch((err) => {
  console.error(err);
});
