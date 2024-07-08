// Import helpers
import getRepoImageList from './getRepoImageList.js';

// Import classes
import AssumedRole from '../classes/AssumedRole.js';

/**
 * Confirms that a tag is the latest for a repo
 * @author Jay Luker
 * @param {string} repoName
 * @param {string} tag
 * @returns {boolean}
 */
const isLatestTag = async (
  assumedRole: AssumedRole,
  repoName: string,
  tag: string,
): Promise<boolean> => {
  const imageList = await getRepoImageList(assumedRole, repoName);
  return (
    !!imageList.length &&
    !!imageList[0].imageTags &&
    imageList[0].imageTags.includes(tag)
  );
};

export default isLatestTag;
