import { Flags } from '@oclif/core';

import {
  createEcrArn,
  getCfnStackExports,
  imageTagExists as getImageTagExists,
  isLatestTag as getIsLatestTag,
  parseEcrArn,
  restartEcsService,
  updateTaskDefAppImage,
} from '../aws/index.js';
// Import base command
import { BaseCommand } from '../base.js';
import { confirm, confirmProductionOp } from '../configPrompts/index.js';
import DeployConfig from '../deployConfig/index.js';
import CfnStackNotFound from '../shared/errors/CfnStackNotFound.js';

// eslint-disable-next-line no-use-before-define
export default class Release extends BaseCommand<typeof Release> {
  static override description = 'release a new version of an app';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --app <app-name>',
  ];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
    'image-tag': Flags.string({
      char: 'i',
      description: 'the docker image version tag to release',
      required: true,
    }),
    'no-deploy': Flags.boolean({
      default: false,
      description:
        "Update the Fargate Task Definition but don't restart the service",
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      app,
      'image-tag': imageTag,
      'no-deploy': noDeploy,
      yes,
    } = this.flags;

    const assumedRole = this.getAssumedRole();
    // see the README section on cross-account ECR access
    if (this.ecrAccessRoleArn !== undefined) {
      assumedRole.setAssumedRoleArn(this.ecrAccessRoleArn);
    }

    const deployConfig = await this.getDeployConfig(assumedRole);

    const cfnStackName = this.getCfnStackName();
    let cfnExports: Record<string, string>;
    try {
      cfnExports = await getCfnStackExports(cfnStackName);
      for (const exportValue of ['taskDefName', 'clusterName', 'serviceName']) {
        if (cfnExports[exportValue] === undefined) {
          throw new Error(`Incomplete app stack: missing ${exportValue}`);
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error instanceof CfnStackNotFound ||
          error.message.includes('Incomplete'))
      ) {
        this.exitWithError(error.message);
      }

      throw error;
    }

    /**
     * caccl-deploy allows non-ECR images, but in the `caccl-deploy` context
     * we can assume that `appImage` will be an ECR repo ARN
     */
    const repoArn = parseEcrArn(deployConfig.appImage);

    // check that we're actually releasing a different image
    if (repoArn.imageTag === imageTag && !yes) {
      const confirmMsg = `${app} is already using image tag ${imageTag}`;
      (await confirm(`${confirmMsg}. Proceed?`)) || this.exitWithSuccess();
    }

    // check that the specified image tag is legit
    this.log(`Checking that an image exists with the tag ${imageTag}`);
    const imageTagExists = await getImageTagExists(
      assumedRole,
      repoArn.repoName,
      imageTag,
    );
    if (!imageTagExists) {
      this.exitWithError(
        `No image with tag ${imageTag} in ${repoArn.repoName}`,
      );
    }

    // check if it's the latest release and prompt if not
    this.log(`Checking ${imageTag} is the latest tag`);
    const isLatestTag = await getIsLatestTag(
      assumedRole,
      repoArn.repoName,
      imageTag,
    );
    if (!isLatestTag && !yes) {
      this.log(`${imageTag} is not the most recent release`);
      (await confirm('Proceed?')) || this.exitWithSuccess();
    }

    // generate the new repo image arn to be deployed
    const newAppImage = createEcrArn({
      ...repoArn,
      imageTag,
    });

    /**
     * Note that the app's current in-use task def name has to be registered
     * as a cloudformation stack output value because it's too painful to try
     * to get/extract it via the api. `taskDefName` here is also known as the
     * "family" and doesn't include the task def revision/version number
     */
    const { appOnlyTaskDefName, clusterName, serviceName, taskDefName } =
      cfnExports;

    // check that we're not using a wildly different version of the cli
    if (!yes && !(await this.stackVersionDiffCheck())) {
      this.exitWithSuccess();
    }

    if (!(await confirmProductionOp(yes))) {
      this.exitWithSuccess();
    }

    // create a new version of the taskdef with the updated image
    this.log(`Updating ${app} task definitions to use ${newAppImage}`);
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
    this.log('Updating stored deployment configuration');
    await DeployConfig.update({
      appPrefix: this.getAppPrefix(),
      deployConfig,
      param: 'appImage',
      value: newAppImage,
    });

    // restart the service
    if (!noDeploy) {
      this.log(`Restarting the ${serviceName} service...`);
      await restartEcsService({
        cluster: clusterName,
        newTaskDefArn,
        service: serviceName,
        wait: true,
      });
      this.exitWithSuccess('done.');
    }

    this.exitWithSuccess(
      [
        'Redployment skipped',
        'WARNING: service is out-of-sync with stored deployment configuration',
      ].join('\n'),
    );
  }
}
