// Import path
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import oclif
import { Flags } from '@oclif/core'

// Import base command
import { BaseCommand } from '../base.js';

import { execSync } from 'child_process';

import tempy from 'tempy';

import { cfnStackExists, getAccountId, getCfnStackExports } from '../aws/index.js';

import { confirmProductionOp } from '../configPrompts/index.js';

import CACCL_DEPLOY_VERSION from '../constants/CACCL_DEPLOY_VERSION.js';

import exitWithError from '../helpers/exitWithError.js';
import exitWithSuccess from '../helpers/exitWithSuccess.js';
import isProdAccount from '../helpers/isProdAccount.js';
import DeployConfig from '../deployConfig/index.js';

type EnvAdditions = {
  AWS_REGION: string;
  CDK_DISABLE_VERSION_CHECK: string;
  AWS_PROFILE?: string;
  CDK_STACK_PROPS_FILE_PATH?: string;
};

export default class Stack extends BaseCommand<typeof Stack> {
  static override description = "diff, deploy, or delete the app's AWS resources";

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
  }

  static override strict = false;

  public async run(): Promise<void> {
    // Destructure flags
    const {
      yes,
      profile,
    } = this.flags;
    // get this without resolved secrets for passing to cdk
    const assumedRole = this.getAssumedRole()
    const deployConfig = await this.getDeployConfig(assumedRole, true);

    // get it again with resolved secrets so we can make our hash
    const deployConfigHash = DeployConfig.toHash(await this.getDeployConfig(assumedRole));

    /**
     * Get the important ids/names from our infrastructure stack:
     *   - id of the vpc
     *   - name of the ECS cluster
     *   - name of the S3 bucket where the load balancer will send logs
     */
    const cfnStackName = this.getCfnStackName();
    const stackExists = await cfnStackExists(cfnStackName);
    const { vpcId, ecsClusterName, albLogBucketName } = await getCfnStackExports(
      deployConfig.infraStackName,
    );

    /**
     * Create an object structure with all the info
     * the CDK stack operation will need
     */
    const cdkStackProps = {
      vpcId,
      ecsClusterName,
      albLogBucketName,
      cacclDeployVersion: CACCL_DEPLOY_VERSION,
      deployConfigHash,
      stackName: cfnStackName,
      awsAccountId: await getAccountId(),
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      deployConfig,
    };

    const envAdditions: EnvAdditions = {
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      CDK_DISABLE_VERSION_CHECK: 'true',
    };

    // all args/options following the `stack` subcommand get passed to cdk
    const cdkArgs = [...this.argv]; // FIXME:

    // default cdk operation is `list`
    if (!cdkArgs.length) {
      cdkArgs.push('list');
    } else if (cdkArgs[0] === 'dump') {
      exitWithSuccess(JSON.stringify(cdkStackProps, null, '  '));
    } else if (cdkArgs[0] === 'info') {
      if (!stackExists) {
        exitWithError(`Stack ${cfnStackName} has not been deployed yet`);
      }
      const stackExports = await getCfnStackExports(cfnStackName);
      exitWithSuccess(JSON.stringify(stackExports, null, '  '));
    } else if (cdkArgs[0] === 'changeset') {
      cdkArgs.shift();
      cdkArgs.unshift('deploy', '--no-execute');
    }

    // tell cdk to use the same profile
    if (profile !== undefined) {
      cdkArgs.push('--profile', profile);
      envAdditions.AWS_PROFILE = profile;
    }

    // disable cdk prompting if user included `--yes` flag
    if (
      yes &&
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
      if (stackExists && !yes && !(await this.stackVersionDiffCheck())) {
        exitWithSuccess();
      }
      // production failsafe if we're actually changing anything
      if (!(await confirmProductionOp(yes))) {
        exitWithSuccess();
      }
    }

    // Set some default removal policy options depending on if this is a "prod" account
    if (
      cdkStackProps.deployConfig.dbOptions &&
      !cdkStackProps.deployConfig.dbOptions.removalPolicy
    ) {
      cdkStackProps.deployConfig.dbOptions.removalPolicy = (await isProdAccount())
        ? 'RETAIN'
        : 'DESTROY';
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
          stdio: 'inherit' as const,
          // exec the cdk process in the cdk directory
          // FIXME: put `cdk` in oclif data dir and set cwd to that
          // but how do I access node_modules then...
          cwd: path.join(__dirname, '../..'),
          // inject our additional env vars
          env: { ...process.env, ...envAdditions },
        };

        try {
          execSync(['node_modules/.bin/cdk', ...cdkArgs].join(' '), execOpts);
          exitWithSuccess('done!');
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : `Error while executing CDK: ${err}`;
          exitWithError(message);
        }
      },
    );
  }
}
