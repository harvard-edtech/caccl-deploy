import * as fs from 'fs';
import * as path from 'path';
import { Repository } from '@aws-cdk/aws-ecr';
import { ContainerImage } from '@aws-cdk/aws-ecs';
import { Construct } from '@aws-cdk/core';

export interface CacclContainerImageOptions {
  appImage?: string;
  buildPath?: string;
}

export class CacclContainerImage extends Construct {
  image: ContainerImage;

  constructor(scope: Construct, id: string, props: CacclContainerImageOptions) {
    super(scope, id);

    const { appImage, buildPath = process.env.APP_DIR } = props;

    if (appImage !== undefined) {
      if (appImage.startsWith('arn:aws:ecr')) {
        // need to split any tag off the end of the arn
        let repoTag = 'latest';
        let repoArn;

        const splitArn = appImage.split(':');
        if (splitArn.length === 7) {
          // tag is appended to arn
          repoArn = splitArn.slice(0, 6).join(':');
          repoTag = splitArn.slice(-1).join();
        } else {
          repoArn = appImage;
        }

        const repo = Repository.fromRepositoryArn(this, 'ContainerImageRepo', repoArn);
        this.image = ContainerImage.fromEcrRepository(repo, repoTag);
      } else {
        this.image = ContainerImage.fromRegistry(appImage);
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
