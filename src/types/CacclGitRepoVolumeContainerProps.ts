// Import AWS CDK lib
import { aws_ecs as ecs } from 'aws-cdk-lib';

type CacclGitRepoVolumeContainerProps = {
  appContainer: ecs.ContainerDefinition;
  appContainerPath: string;
  repoUrlSecretArn: string;
  taskDefinition: ecs.TaskDefinition;
};

export default CacclGitRepoVolumeContainerProps;
