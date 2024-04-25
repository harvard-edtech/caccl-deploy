// Import helpers
import getRepoImageList from './getRepoImageList';

/**
 * Confirms that a repo/tag combo exists
 * @param {string} repoName - ECR repository name
 * @param {string} tag - ECR image tag
 * @returns {boolean}
 */
const imageTagExists = async (repoName: string, tag: string) => {
  // FIXME: need assumed role (only used for ECR functions?)
  const imageList = await getRepoImageList(repoName, true);
  return imageList.some((i) => {
    if (!i.imageTags) return false;
    return i.imageTags.includes(tag);
  });
};

export default imageTagExists;
