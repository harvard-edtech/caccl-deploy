import { Construct } from '@aws-cdk/core';
import {
  ContainerDefinition,
  ContainerImage,
  Secret as EcsSecret,
  ContainerDependencyCondition,
} from '@aws-cdk/aws-ecs';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { CacclTaskDef } from './taskdef';

const VOLUME_NAME = 'gitrepovolume';
const VOLUME_CONTAINER_MOUNT_PATH = '/var/gitrepo';

export interface CacclGitRepoVolumeContainerProps {
  cacclTaskDef: CacclTaskDef;
  repoUrlSecretArn: string;
  appContainerPath: string;
}

export class CacclGitRepoVolumeContainer extends Construct {
  container: ContainerDefinition;

  constructor(scope: Construct, id: string, props: CacclGitRepoVolumeContainerProps) {
    super(scope, id);

    const { cacclTaskDef, repoUrlSecretArn, appContainerPath } = props;

    // the volume itself is added to the task definition
    cacclTaskDef.taskDef.addVolume({ name: VOLUME_NAME });

    // container gets the full URL (including auth bits) via secrets manager
    const repoUrlSecret = EcsSecret.fromSecretsManager(Secret.fromSecretArn(this, 'RepoUrlSecret', repoUrlSecretArn));

    this.container = new ContainerDefinition(this, 'GitRepoVolumeContainer', {
      image: ContainerImage.fromRegistry('alpine/git'),
      command: ['git clone --branch master $GIT_REPO_URL /var/gitrepo'],
      entryPoint: ['sh', '-c'],
      essential: false,
      taskDefinition: cacclTaskDef.taskDef,
      secrets: {
        GIT_REPO_URL: repoUrlSecret,
      },
    });

    this.container.addMountPoints({
      containerPath: VOLUME_CONTAINER_MOUNT_PATH,
      readOnly: false,
      sourceVolume: VOLUME_NAME,
    });

    cacclTaskDef.appContainer.addMountPoints({
      containerPath: appContainerPath,
      readOnly: false,
      sourceVolume: VOLUME_NAME,
    });

    cacclTaskDef.appContainer.addContainerDependencies({
      container: this.container,
      condition: ContainerDependencyCondition.SUCCESS,
    });
  }
}
