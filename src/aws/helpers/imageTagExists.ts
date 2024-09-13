// Import helpers
import AssumedRole from '../classes/AssumedRole.js';
import getRepoImageList from './getRepoImageList.js';
// Import classes

/**
 * Confirms that a repo/tag combo exists
 * @author Jay Luker
 * @param {string} repoName - ECR repository name
 * @param {string} tag - ECR image tag
 * @returns {boolean}
 */
const imageTagExists = async (
  assumedRole: AssumedRole,
  repoName: string,
  tag: string,
) => {
  const imageList = await getRepoImageList(assumedRole, repoName, true);
  return imageList.some((i) => {
    if (!i.imageTags) return false;
    return i.imageTags.includes(tag);
  });
};

export default imageTagExists;
