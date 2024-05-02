import { ECR } from 'aws-sdk';

import moment from 'moment';

import { table } from 'table';

import { createEcrArn, getCurrentRegion, getRepoImageList } from '../../aws';

import looksLikeSemver from '../../shared/helpers/looksLikeSemver';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const imagesOperation = async (cmd: CacclDeployCommander) => {
  const assumedRole = cmd.getAssumedRole();
  const opts = cmd.opts();
  // see the README section on cross-account ECR access
  if (cmd.ecrAccessRoleArn !== undefined) {
    assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
  }
  const images = await getRepoImageList(assumedRole, opts.repo, opts.all);
  const region = getCurrentRegion();

  /**
   * Function to filter for the image tags we want.
   * If `--all` flag is provided this will return true for all tags.
   * Otherwise only tags that look like e.g. "1.1.1" or master/stage
   * will be included.
   */
  const includeThisTag = (tag: string): boolean => {
    return (
      opts.all || looksLikeSemver(tag) || ['master', 'stage'].includes(tag)
    );
  };

  const data = images
    .filter((image) => {
      return !!image.imageTags && !!image.registryId;
    })
    .map((image) => {
      const tags = image.imageTags as ECR.ImageTagList;
      const account = image.registryId as string;
      const imageTags = tags.filter(includeThisTag).join('\n');

      /**
       * Filter then list of image ids for just the ones that correspond
       * to the image tags we want to include
       */
      const imageArns = tags
        .reduce((collect: string[], t) => {
          if (includeThisTag(t)) {
            collect.push(
              createEcrArn({
                repoName: opts.repo,
                imageTag: t,
                account,
                region,
              }),
            );
          }
          return collect;
        }, [])
        .join('\n');

      return [moment(image.imagePushedAt).format(), imageTags, imageArns];
    });
  if (data.length) {
    const tableOutput = table([['Pushed On', 'Tags', 'ARNs'], ...data]);
    exitWithSuccess(tableOutput);
  }
  exitWithError('No images found');
};

export default imagesOperation;
