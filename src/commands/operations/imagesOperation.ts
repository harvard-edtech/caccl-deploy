import moment from 'moment';

import { table } from 'table';

import {
  createEcrArn,
  getCurrentRegion,
  getRepoImageList,
  // setAssumedRoleArn,
} from '../../aws';

import looksLikeSemver from '../../shared/helpers/looksLikeSemver';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const imagesOperation = async (cmd) => {
  // see the README section on cross-account ECR access
  if (cmd.ecrAccessRoleArn !== undefined) {
    // FIXME:
    // setAssumedRoleArn(cmd.ecrAccessRoleArn);
  }
  const images = await getRepoImageList(cmd.repo, cmd.all);
  const region = getCurrentRegion();

  /**
   * Function to filter for the image tags we want.
   * If `--all` flag is provided this will return true for all tags.
   * Otherwise only tags that look like e.g. "1.1.1" or master/stage
   * will be included.
   */
  const includeThisTag = (t) => {
    return cmd.all || looksLikeSemver(t) || ['master', 'stage'].includes(t);
  };

  const data = images.map((i) => {
    const imageTags = i.imageTags.filter(includeThisTag).join('\n');

    /**
     * Filter then list of image ids for just the ones that correspond
     * to the image tags we want to include
     */
    const imageArns = i.imageTags
      .reduce((collect: string[], t) => {
        if (includeThisTag(t)) {
          collect.push(
            createEcrArn({
              repoName: cmd.repo,
              imageTag: t,
              account: i.registryId,
              region,
            }),
          );
        }
        return collect;
      }, [])
      .join('\n');

    return [moment(i.imagePushedAt).format(), imageTags, imageArns];
  });
  if (data.length) {
    const tableOutput = table([['Pushed On', 'Tags', 'ARNs'], ...data]);
    exitWithSuccess(tableOutput);
  }
  exitWithError('No images found');
};

export default imagesOperation;
