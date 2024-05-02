import {
  createEcrArn,
  getCfnStackExports,
  isLatestTag as getIsLatestTag,
  imageTagExists as getImageTagExists,
  parseEcrArn,
  restartEcsService,
  updateTaskDefAppImage,
} from '../../aws';

import { confirm, confirmProductionOp } from '../../configPrompts';

import DeployConfig from '../../deployConfig';

import CfnStackNotFound from '../../shared/errors/CfnStackNotFound';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const releaseOperation = async (cmd: CacclDeployCommander) => {
  const assumedRole = cmd.getAssumedRole();
  // see the README section on cross-account ECR access
  if (cmd.ecrAccessRoleArn !== undefined) {
    assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
  }

  const deployConfig = await cmd.getDeployConfig(assumedRole);

  const cfnStackName = cmd.getCfnStackName();
  let cfnExports: Record<string, string>;
  try {
    cfnExports = await getCfnStackExports(cfnStackName);
    ['taskDefName', 'clusterName', 'serviceName'].forEach((exportValue) => {
      if (cfnExports[exportValue] === undefined) {
        throw new Error(`Incomplete app stack: missing ${exportValue}`);
      }
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err instanceof CfnStackNotFound || err.message.includes('Incomplete'))
    ) {
      exitWithError(err.message);
    }
    throw err;
  }

  /**
   * caccl-deploy allows non-ECR images, but in the `caccl-deploy` context
   * we can assume that `appImage` will be an ECR repo ARN
   */
  const repoArn = parseEcrArn(deployConfig.appImage);

  // check that we're actually releasing a different image
  if (repoArn.imageTag === cmd.imageTag && !cmd.yes) {
    const confirmMsg = `${cmd.app} is already using image tag ${cmd.imageTag}`;
    (await confirm(`${confirmMsg}. Proceed?`)) || exitWithSuccess();
  }

  // check that the specified image tag is legit
  console.log(`Checking that an image exists with the tag ${cmd.imageTag}`);
  const imageTagExists = await getImageTagExists(
    assumedRole,
    repoArn.repoName,
    cmd.imageTag,
  );
  if (!imageTagExists) {
    exitWithError(`No image with tag ${cmd.imageTag} in ${repoArn.repoName}`);
  }

  // check if it's the latest release and prompt if not
  console.log(`Checking ${cmd.imageTag} is the latest tag`);
  const isLatestTag = await getIsLatestTag(
    assumedRole,
    repoArn.repoName,
    cmd.imageTag,
  );
  if (!isLatestTag && !cmd.yes) {
    console.log(`${cmd.imageTag} is not the most recent release`);
    (await confirm('Proceed?')) || exitWithSuccess();
  }

  // generate the new repo image arn to be deployed
  const newAppImage = createEcrArn({
    ...repoArn,
    imageTag: cmd.imageTag,
  });

  /**
   * Note that the app's current in-use task def name has to be registered
   * as a cloudformation stack output value because it's too painful to try
   * to get/extract it via the api. `taskDefName` here is also known as the
   * "family" and doesn't include the task def revision/version number
   */
  const { taskDefName, appOnlyTaskDefName, clusterName, serviceName } =
    cfnExports;

  // check that we're not using a wildly different version of the cli
  if (!cmd.yes && !(await cmd.stackVersionDiffCheck())) {
    exitWithSuccess();
  }

  if (!(await confirmProductionOp(cmd.yes))) {
    exitWithSuccess();
  }

  // create a new version of the taskdef with the updated image
  console.log(`Updating ${cmd.app} task definitions to use ${newAppImage}`);
  // the app's service task def
  const newTaskDefArn = await updateTaskDefAppImage(
    taskDefName,
    newAppImage,
    'AppContainer',
  );
  // the app-only one-off task definition
  await updateTaskDefAppImage(
    appOnlyTaskDefName,
    newAppImage,
    'AppOnlyContainer',
  );

  // update the ssm parameter
  console.log('Updating stored deployment configuration');
  await DeployConfig.update({
    deployConfig,
    appPrefix: cmd.getAppPrefix(),
    param: 'appImage',
    value: newAppImage,
  });

  // restart the service
  if (cmd.deploy) {
    console.log(`Restarting the ${serviceName} service...`);
    await restartEcsService({
      cluster: clusterName,
      service: serviceName,
      newTaskDefArn,
      wait: true,
    });
    exitWithSuccess('done.');
  }
  exitWithSuccess(
    [
      'Redployment skipped',
      'WARNING: service is out-of-sync with stored deployment configuration',
    ].join('\n'),
  );
};

export default releaseOperation;
