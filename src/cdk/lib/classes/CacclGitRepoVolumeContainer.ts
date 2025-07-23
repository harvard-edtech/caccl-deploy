import {
  aws_ecs as ecs,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types
import { type CacclGitRepoVolumeContainerProps } from '../../../types/index.js';
// Import constants
import VOLUME_CONTAINER_MOUNT_PATH from '../constants/VOLUME_CONTAINER_MOUNT_PATH.js';
import VOLUME_NAME from '../constants/VOLUME_NAME.js';

class CacclGitRepoVolumeContainer extends Construct {
  container: ecs.ContainerDefinition;

  constructor(
    scope: Construct,
    id: string,
    props: CacclGitRepoVolumeContainerProps,
  ) {
    super(scope, id);

    const { appContainer, appContainerPath, repoUrlSecretArn, taskDefinition } =
      props;

    // the volume itself is added to the task definition
    taskDefinition.addVolume({ name: VOLUME_NAME });

    // container gets the full URL (including auth bits) via secrets manager
    const repoUrlSecret = ecs.Secret.fromSecretsManager(
      secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'RepoUrlSecret',
        repoUrlSecretArn,
      ),
    );

    this.container = new ecs.ContainerDefinition(
      this,
      'GitRepoVolumeContainer',
      {
        command: ['git clone --branch master $GIT_REPO_URL /var/gitrepo'],
        entryPoint: ['sh', '-c'],
        essential: false,
        image: ecs.ContainerImage.fromRegistry('alpine/git'),
        secrets: {
          GIT_REPO_URL: repoUrlSecret,
        },
        taskDefinition,
      },
    );

    this.container.addMountPoints({
      containerPath: VOLUME_CONTAINER_MOUNT_PATH,
      readOnly: false,
      sourceVolume: VOLUME_NAME,
    });

    appContainer.addMountPoints({
      containerPath: appContainerPath,
      readOnly: false,
      sourceVolume: VOLUME_NAME,
    });

    appContainer.addContainerDependencies({
      condition: ecs.ContainerDependencyCondition.SUCCESS,
      container: this.container,
    });
  }
}

export default CacclGitRepoVolumeContainer;
