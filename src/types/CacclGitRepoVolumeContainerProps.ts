// Import AWS CDK lib
import { aws_ecs as ecs } from 'aws-cdk-lib';

type CacclGitRepoVolumeContainerProps = {
  taskDefinition: ecs.TaskDefinition;
  appContainer: ecs.ContainerDefinition;
  repoUrlSecretArn: string;
  appContainerPath: string;
};

export default CacclGitRepoVolumeContainerProps;
