import {
  DescribeImagesCommand,
  type DescribeImagesCommandInput,
  ECRClient,
  type ImageDetail,
  TagStatus,
} from '@aws-sdk/client-ecr';

import type { CacclDeployContext } from '../../types/CacclDeployContext.js';

import looksLikeSemver from '../../shared/helpers/looksLikeSemver.js';
import getAssumedRoleCredentials from './getAssumedRoleCredentials.js';
import getPaginatedResponseV3 from './getPaginatedResponseV3.js';

/**
 * Get information about all ECR images in a specified repository.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {CacclDeployContext} context - CACCL deploy context
 * @param {string} repo - ECR repository name, e.g. 'hdce/fooapp'
 * @param {boolean} all - return all tags; don't filter for master, stage,
 *   tags that look like semver, etc
 * @returns {ImageDetail[]} ECR image details.
 */
const getRepoImageList = async (
  context: CacclDeployContext,
  repo: string,
  all?: boolean,
): Promise<ImageDetail[]> => {
  const client = new ECRClient(await getAssumedRoleCredentials(context));
  const input = {
    filter: {
      tagStatus: TagStatus.TAGGED,
    },
    maxResults: 1000,
    repositoryName: repo,
  };

  const images = await getPaginatedResponseV3(
    async (_input: DescribeImagesCommandInput) => {
      const command = new DescribeImagesCommand(_input);
      const res = await client.send(command);
      return {
        items: res.imageDetails,
        nextToken: res.nextToken,
      };
    },
    input,
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
