import * as fs from 'fs';
import * as path from 'path';
import { Construct } from '@aws-cdk/core';
import { ContainerImage } from '@aws-cdk/aws-ecs';
import { Repository } from '@aws-cdk/aws-ecr';

export interface CacclContainerImageOptions {
  repoName?: string;
  buildPath?: string;
  repoType?: string;
}

export class CacclContainerImage extends Construct {
  image: ContainerImage;

  constructor(scope: Construct, id: string, props: CacclContainerImageOptions) {
    super(scope, id);

    const { repoName, repoType, buildPath = process.env.APP_DIR } = props;

    if (repoName !== undefined) {
      if (repoType === 'ecr') {
        const repo = Repository.fromRepositoryName(this, 'ContainerImageRepo', repoName);
        this.image = ContainerImage.fromEcrRepository(repo);
      } else {
        this.image = ContainerImage.fromRegistry(repoName);
      }
    } else if (buildPath !== undefined) {
      if (!fs.existsSync(path.join(buildPath, 'Dockerfile'))) {
        console.error(`No Dockerfile found at ${buildPath}`);
        process.exit(1);
      }
      this.image = ContainerImage.fromAsset(buildPath);
    } else {
      console.error('Missing configuration options for building the app image');
      console.error('At least one of the following must be defined:');
      console.error(' * deployConfig.appImage.repoName');
      console.error(' * deployConfig.appImage.buildPath');
      console.error(' * the $APP_DIR environment variable');
      process.exit(1);
    }
  }
}
