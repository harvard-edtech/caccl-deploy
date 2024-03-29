import {
  aws_ecs as ecs,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const VOLUME_NAME = 'gitrepovolume';
const VOLUME_CONTAINER_MOUNT_PATH = '/var/gitrepo';

export interface CacclGitRepoVolumeContainerProps {
  taskDefinition: ecs.TaskDefinition;
  appContainer: ecs.ContainerDefinition;
  repoUrlSecretArn: string;
  appContainerPath: string;
}

export class CacclGitRepoVolumeContainer extends Construct {
  container: ecs.ContainerDefinition;

  constructor(
    scope: Construct,
    id: string,
    props: CacclGitRepoVolumeContainerProps,
  ) {
    super(scope, id);

    const { taskDefinition, appContainer, repoUrlSecretArn, appContainerPath } =
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
        image: ecs.ContainerImage.fromRegistry('alpine/git'),
        command: ['git clone --branch master $GIT_REPO_URL /var/gitrepo'],
        entryPoint: ['sh', '-c'],
        essential: false,
        taskDefinition,
        secrets: {
          GIT_REPO_URL: repoUrlSecret,
        },
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
      container: this.container,
      condition: ecs.ContainerDependencyCondition.SUCCESS,
    });
  }
}
