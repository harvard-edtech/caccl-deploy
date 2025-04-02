import { aws_ecs as ecs } from 'aws-cdk-lib';

/**
 * Container volume configuration.
 * @author Benedikt Arnarsson
 */
type CacclGitRepoVolumeContainerProps = {
  appContainer: ecs.ContainerDefinition;
  appContainerPath: string;
  repoUrlSecretArn: string;
  taskDefinition: ecs.TaskDefinition;
};

export default CacclGitRepoVolumeContainerProps;
