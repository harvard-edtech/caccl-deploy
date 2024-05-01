import tempy from 'tempy';

import { cfnStackExists, getAccountId, getCfnStackExports } from '../../aws';

import { confirmProductionOp } from '../../configPrompts';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';
import isProdAccount from '../helpers/isProdAccount';

const stackOperation = async (cmd: any) => {
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
    cacclDeployVersion,
    deployConfigHash,
    stackName: cfnStackName,
    awsAccountId: await getAccountId(),
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    deployConfig,
  };

  const envAdditions = {
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    CDK_DISABLE_VERSION_CHECK: true,
  };

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

  // tell cdk to use the same profile
  if (cmd.profile !== undefined) {
    cdkArgs.push('--profile', cmd.profile);
    envAdditions.AWS_PROFILE = cmd.profile;
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
        stdio: 'inherit',
        // exec the cdk process in the cdk directory
        cwd: __dirname, // path.join(__dirname, 'cdk'),
        // inject our additional env vars
        env: { ...process.env, ...envAdditions },
      };

      try {
        execSync(['node_modules/.bin/cdk', ...cdkArgs].join(' '), execOpts);
        exitWithSuccess('done!');
      } catch (err) {
        exitWithError(err.msg);
      }
    },
  );
};

export default stackOperation;
