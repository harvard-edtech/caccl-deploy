import type { CacclDeployContext } from '../../types/CacclDeployContext.js';

import getRepoImageList from './getRepoImageList.js';

/**
 * Confirms that a tag is the latest for a repo
 * @author Jay Luker, Benedikt Arnarsson
 * @param {CacclDeployContext} context CACCL deploy context
 * @param {string} repoName repo whose tags we are checking.
 * @param {string} tag tag which we wan to confirm as the latest.
 * @returns {Promise<boolean>} whether the tag is the latest on the repo
 */
const isLatestTag = async (
  context: CacclDeployContext,
  repoName: string,
  tag: string,
): Promise<boolean> => {
  const imageList = await getRepoImageList(context, repoName);
  return (
    imageList.length > 0 &&
    imageList[0] !== undefined &&
    !!imageList[0].imageTags &&
    imageList[0].imageTags.includes(tag)
  );
};

export default isLatestTag;
