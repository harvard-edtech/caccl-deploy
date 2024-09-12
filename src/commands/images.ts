// Import aws SDK
import { ECR } from 'aws-sdk';

// Import oclif
import { Flags } from '@oclif/core'

// Import moment
import moment from 'moment';

// Import table
import { table } from 'table';

// Import base command
import { BaseCommand } from '../base.js';

// Import aws helpers
import { createEcrArn, getCurrentRegion, getRepoImageList } from '../aws/index.js';

// Import helpers
import looksLikeSemver from '../shared/helpers/looksLikeSemver.js';

export default class Images extends BaseCommand<typeof Images> {
  static override description = 'list the most recent available ECR images for an app';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override flags = {
    'repo': Flags.string({
      char: 'r',
      required: true,
      description: 'the name of the ECR repo; use `caccl-deploy app repos` for available repos',
    }),
    'all': Flags.boolean({
      char: 'a',
      description: 'show all images; default is to show only semver-tagged releases',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      all,
      repo,
    } = this.flags;
  
    const assumedRole = this.getAssumedRole();
    // see the README section on cross-account ECR access
    if (this.ecrAccessRoleArn !== undefined) {
      assumedRole.setAssumedRoleArn(this.ecrAccessRoleArn);
    }
    const images = await getRepoImageList(assumedRole, repo, all);
    const region = getCurrentRegion();

    const data = images
      .filter((image) => {
        return !!image.imageTags && !!image.registryId;
      })
      .map((image) => {
        const tags = image.imageTags as ECR.ImageTagList;
        const account = image.registryId as string;
        const imageTags = tags.join('\n');

        /**
         * Filter then list of image ids for just the ones that correspond
         * to the image tags we want to include
         */
        const imageArns = tags
          .reduce((collect: string[], t) => {
              collect.push(
                createEcrArn({
                  repoName: repo,
                  imageTag: t,
                  account,
                  region,
                }),
              );
            return collect;
          }, [])
          .join('\n');

        return [moment(image.imagePushedAt).format(), imageTags, imageArns];
      });
    if (data.length) {
      const tableOutput = table([['Pushed On', 'Tags', 'ARNs'], ...data]);
      this.exitWithSuccess(tableOutput);
    }
    this.exitWithError('No images found');
  }
}
