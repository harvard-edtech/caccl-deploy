// Import aws-sdk
import AWS from 'aws-sdk';

// Import shared helpers
import getPaginatedResponse from './getPaginatedResponse.js';
import looksLikeSemver from '../../shared/helpers/looksLikeSemver.js';

// Import classes
import AssumedRole from '../classes/AssumedRole.js';

/**
 * @author Jay Luker
 * @param {string} repo - ECR repository name, e.g. 'hdce/fooapp'
 * @param {boolean} all - return all tags; don't filter for master, stage,
 *   tags that look like semver, etc
 * @returns {object[]}
 */
const getRepoImageList = async (
  assumedRole: AssumedRole,
  repo: string,
  all?: boolean,
) => {
  const ecr = await assumedRole.getAssumedRoleClient(AWS.ECR);
  const images = await getPaginatedResponse(
    ecr.describeImages.bind(ecr),
    {
      repositoryName: repo,
      maxResults: 1000,
      filter: {
        tagStatus: 'TAGGED',
      },
    },
    'imageDetails',
  );

  // sort the images by the date they were pushed to ECR
  images.sort((a, b) => {
    if (!a.imagePushedAt) return 1;
    if (!b.imagePushedAt) return -1;
    if (a.imagePushedAt < b.imagePushedAt) {
      return 1;
    }
    if (a.imagePushedAt > b.imagePushedAt) {
      return -1;
    }
    return 0;
  });

  if (!all) {
    // find the latest semver tagged image
    return images.filter((i) => {
      if (!i.imageTags) return false;
      return i.imageTags.some((t) => {
        return looksLikeSemver(t) || ['main', 'master', 'stage'].includes(t);
      });
    });
  }
  return images;
};

export default getRepoImageList;
