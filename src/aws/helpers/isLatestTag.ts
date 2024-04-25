// Import helpers
import getRepoImageList from './getRepoImageList';

/**
 * Confirms that a tag is the latest for a repo
 * @param {string} repoName
 * @param {string} tag
 * @returns {boolean}
 */
const isLatestTag = async (repoName: string, tag: string): Promise<boolean> => {
  // FIXME: change getRepoImageList arguments
  const imageList = await getRepoImageList(repoName);
  return (
    !!imageList.length &&
    !!imageList[0].imageTags &&
    imageList[0].imageTags.includes(tag)
  );
};

export default isLatestTag;
