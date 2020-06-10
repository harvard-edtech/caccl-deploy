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
        // need to split any tag off the end of the arn
        let repoTag = 'latest';
        let repoArn;

        const splitArn = repoName.split(':');
        if (splitArn.length === 7) {
          // tag is appended to arn
          repoArn = splitArn.slice(0, 6).join(':');
          repoTag = splitArn.slice(-1).join();
        } else {
          repoArn = repoName;
        }

        const repo = Repository.fromRepositoryArn(this, 'ContainerImageRepo', repoArn);
        this.image = ContainerImage.fromEcrRepository(repo, repoTag);
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
