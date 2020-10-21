#!/usr/bin/env node

const { Command } = require('commander');
const { spawnSync } = require('child_process');
const { table } = require('table');
const path = require('path');
const moment = require('moment');
const aws = require('./lib/aws');
const conf = require('./lib/conf');
const DeployConfig = require('./lib/deployConfig');
const { confirm } = require('./lib/helpers');
const { description } = require('./package.json');

const cacclDeployVersion = require('./lib/generateVersion')();

const initAwsProfile = (profile) => {
  try {
    aws.initProfile(profile);
  } catch (err) {
    console.log(err);
    return err;
  }
};

class DeckCommander extends Command {
  createCommand(name) {
    const cmd = new DeckCommander(name)
      .storeOptionsAsProperties();
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
    const AppPrefix = this.getAppPrefix();
    try {
      const deployConfig = await DeployConfig.fromSsmParams(
        AppPrefix,
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

  appOption() {
    return this.requiredOption(
      '-a --app <string>',
      'name of the app to work with'
    );
  }
}

async function main() {
  const deck = new DeckCommander()
    .version(cacclDeployVersion)
    .description(description);

  deck
    .command('list')
    .description('list available app configurations')
    .commonOptions()
    .passCommandToAction()
    .action(async (cmd) => {
      const apps = await aws.getAppList(cmd.ssmRootPrefix);
      const tableData = apps.map((a) => {
        return [a];
      });
      console.log(apps.length
        ? table([['App'], ...tableData])
        : `No app configurations found using ssm root prefix ${cmd.ssmRootPrefix}`);
    });

  deck
    .command('import')
    .description('import an app deploy configuration from a json file')
    .commonOptions()
    .appOption()
    .option('-f --file <path>',
      'path to a deploy config json file')
    .option('-F --force',
      'non-interactive, yes to everything, overwrite existing, etc')
    .option('-W --wipe',
      'wipe out any existing config (this will not delete entries created in secretsmanager)')
    .passCommandToAction()
    .action(async (cmd) => {
      const deployConfig = DeployConfig.fromFile(cmd.file);
      const existingApps = await aws.getAppList(cmd.ssmRootPrefix);

      if (existingApps.includes(cmd.appName)) {
        console.log(`Configuration for ${cmd.appName} already exists`);
        if (!cmd.force && !await confirm('Overwrite?')) {
          console.log('Bye!');
          process.exit();
        }
      }

      const AppPrefix = cmd.getAppPrefix();
      if (cmd.wipe) {
        await DeployConfig.wipeExisting(AppPrefix);
      }

      await deployConfig.syncToSsm(AppPrefix);
    });

  deck
    .command('delete')
    .description('delete an app configuration')
    .commonOptions()
    .appOption()
    .passCommandToAction()
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

  deck
    .command('show')
    .description('display an app\'s current configuration')
    .commonOptions()
    .appOption()
    .option('-f --flat',
      'display the flattened, key: value form of the config')
    .option('--no-resolve-secrets',
      'show app environment secret value ARNs instead of dereferencing')
    .passCommandToAction()
    .action(async (cmd) => {
      const deployConfig = await cmd.getDeployConfig(cmd.resolveSecrets);
      console.log(deployConfig.toString(true, cmd.flat));
    });

  deck
    .command('repos')
    .description('list the available ECR repositories')
    .commonOptions()
    .passCommandToAction()
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

  deck
    .command('images')
    .description('list the most recent available ECR images for an app')
    .commonOptions()
    .requiredOption('-r --repo <string>',
      'the name of the ECR repo; use `deck app repos` for available repos')
    .option('-A --all',
      'show all images; default is to show only semver-tagged releases')
    .passCommandToAction()
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }
      const images = await aws.getRepoImageList(cmd.repo, cmd.all);
      const data = images.map((i) => {
        return [
          moment(i.imagePushedAt).format(),
          i.imageTags.join('\n'),
        ];
      });
      if (data.length) {
        const tableOutput = table([
          ['Pushed On', 'Tags'],
          ...data,
        ]);
        console.log(tableOutput);
      } else {
        console.log('No images found');
      }
    });

  deck
    .command('release')
    .description('release a new version of an app')
    .commonOptions()
    .appOption()
    .requiredOption('-i --image-tag <string>',
      'the docker image version tag to release')
    .option('-f --force',
      'just do it; no confirmations or prompts')
    .option('--no-deploy',
      'Update the Fargate Task Definition but don\' restart the service')
    .passCommandToAction()
    .action(async (cmd) => {
      if (cmd.ecrAccessRoleArn !== undefined) {
        aws.setAssumedRoleArn(cmd.ecrAccessRoleArn);
      }

      const deployConfig = await cmd.getDeployConfig();

      const cfnStackName = cmd.getCfnStackName();
      let cfnOutputs;
      try {
        cfnOutputs = await aws.getCfnStackOutputs(cfnStackName);
      } catch (err) {
        if (err.name === 'CfnStackNotFound') {
          console.log(err.message);
        }
        process.exit(1);
      }

      /**
       * caccl-deploy allows non-ECR images, but in the `deck` context
       * we can assume that `appImage.repoName` will be an ECR repo ARN
       */
      const repoArn = aws.parseEcrArn(deployConfig.appImage.repoName);

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
      const newAppImageRepoName = aws.createEcrArn({
        ...repoArn,
        imageTag: cmd.imageTag,
      });

      const { taskDefName, clusterName, serviceName } = cfnOutputs;

      console.log(`Updating ${cmd.appName} task to use ${newAppImageRepoName}`);
      await aws.updateTaskDefAppImage(taskDefName, newAppImageRepoName);

      // update the ssm parameter
      console.log('Updating stored deployment configuration');
      await deployConfig.update(
        cmd.getAppPrefix(),
        'appImage/repoName',
        newAppImageRepoName
      );

      // restart the service
      if (cmd.deploy) {
        console.log(`Restarting the ${serviceName} service...`);
        await aws.restartEcsServcie(clusterName, serviceName);
      } else {
        console.log('Redployment skipped');
        console.log('WARNING: service is out-of-sync with stored deployment configuration');
      }
    });

  deck
    .command('restart')
    .description('no changes; just force a restart')
    .commonOptions()
    .appOption()
    .passCommandToAction()
    .action(async (cmd) => {
      const cfnStackName = cmd.getCfnStackName();
      let cfnOutputs;
      try {
        cfnOutputs = await aws.getCfnStackOutputs(cfnStackName);
      } catch (err) {
        if (err.name === 'CfnStackNotFound') {
          console.log(err.message);
        }
        process.exit(1);
      }
      const { clusterName, serviceName } = cfnOutputs;
      // restartthe service
      await aws.restartEcsServcie(clusterName, serviceName);
    });

  deck
    .command('update')
    .description('update (or delete) a single deploy config setting')
    .commonOptions()
    .appOption()
    .option('-D --delete',
      'delete the named parameter instead of creating/updating')
    .passCommandToAction()
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

  deck
    .command('new')
    .commonOptions()
    .description('generate a new app configuration')
    .action(async () => {

    });

  deck
    .command('stack')
    .commonOptions()
    .appOption()
    .option('-F --force',
      'non-interactive, yes to everything, overwrite existing, etc')
    .description('diff, deploy, update or delete the app\'s AWS resources')
    .action(async (cmd) => {
      const cdkArgs = [...cmd.args];
      const cfnStackName = cmd.getCfnStackName();

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
      envAdditions.CACCL_DEPLOY_APP_NAME = cmd.app;
      envAdditions.CACCL_DEPLOY_SSM_APP_PREFIX = cmd.getAppPrefix();
      envAdditions.CACCL_DEPLOY_STACK_NAME = cfnStackName;
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

  await deck.parse(process.argv);
}

main();
