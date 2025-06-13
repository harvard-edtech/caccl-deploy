import { Flags } from '@oclif/core';
import moment from 'moment';
import { table } from 'table';

import {
  createEcrArn,
  getCurrentRegion,
  getRepoImageList,
} from '../aws/index.js';
import { BaseCommand } from '../base.js';

// eslint-disable-next-line no-use-before-define
export default class Images extends BaseCommand<typeof Images> {
  static override description =
    'list the most recent available ECR images for an app';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    all: Flags.boolean({
      char: 'a',
      default: false,
      description:
        'show all images; default is to show only semver-tagged releases',
    }),
    repo: Flags.string({
      char: 'r',
      description:
        'the name of the ECR repo; use `caccl-deploy app repos` for available repos',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const { all, repo } = this.flags;

    const images = await getRepoImageList(this.context, repo, all);
    const region = await getCurrentRegion();

    const data = images.flatMap((image) => {
      if (!image.imageTags || !image.registryId) {
        return [];
      }

      const tags = image.imageTags;
      const account = image.registryId;
      const imageTags = tags.join('\n');

      /**
       * Filter then list of image ids for just the ones that correspond
       * to the image tags we want to include
       */
      const imageArns = tags
        .reduce((collect: string[], t) => {
          collect.push(
            createEcrArn({
              account,
              imageTag: t,
              region,
              repoName: repo,
            }),
          );
          return collect;
        }, [])
        .join('\n');

      return [[moment(image.imagePushedAt).format(), imageTags, imageArns]];
    });
    if (data.length > 0) {
      const tableOutput = table([['Pushed On', 'Tags', 'ARNs'], ...data]);
      this.exitWithSuccess(tableOutput);
    }

    this.exitWithError('No images found');
  }
}
