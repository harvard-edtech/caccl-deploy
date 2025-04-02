import CacclDeployContext from '../../types/CacclDeployContext.js';
import getRepoImageList from './getRepoImageList.js';

/**
 * Confirms that a repo/tag combo exists
 * @author Jay Luker, Benedikt Arnarsson
 * @param {CacclDeployContext} context - CACCL deploy context
 * @param {string} repoName - ECR repository name
 * @param {string} tag - ECR image tag
 * @returns {Promise<boolean>} whether the repo/tag combo exists
 */
const imageTagExists = async (
  context: CacclDeployContext,
  repoName: string,
  tag: string,
) => {
  const imageList = await getRepoImageList(context, repoName, true);
  return imageList.some((i) => {
    if (!i.imageTags) return false;
    return i.imageTags.includes(tag);
  });
};

export default imageTagExists;
