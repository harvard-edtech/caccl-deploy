import {
  DescribeRepositoriesCommand,
  ECRClient,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-ecr';

import CacclDeployContext from '../../types/CacclDeployContext.js';
import getAssumedRoleCredentials from './getAssumedRoleCredentials.js';
import getPaginatedResponseV3 from './getPaginatedResponseV3.js';

/**
 * @author Jay Luker, Benedikt Arnarsson
 * @param {CacclDeployContext} context CACCL deploy CLI context
 * @returns {string[]} - array of ECR repository names
 */
const getRepoList = async (context: CacclDeployContext): Promise<string[]> => {
  const client = new ECRClient(getAssumedRoleCredentials(context));

  const repos = await getPaginatedResponseV3(async (_input) => {
    const command = new DescribeRepositoriesCommand(_input);
    const res = await client.send(command);
    return {
      items: res.repositories,
      nextToken: res.nextToken,
    };
  }, {});

  const unflattenedRes = await Promise.all(
    repos.map(async (repo) => {
      const emptyArr: string[] = [];
      if (!repo.repositoryArn) return emptyArr;
      const command = new ListTagsForResourceCommand({
        resourceArn: repo.repositoryArn,
      });
      const tagResp = await client.send(command);

      if (!tagResp.tags) return emptyArr;
      const isAnEdtechAppRepo = tagResp.tags.some((t) => {
        return t.Key === 'product' && t.Value === 'edtech-apps';
      });

      if (isAnEdtechAppRepo && repo.repositoryName) {
        return [repo.repositoryName];
      }

      return emptyArr;
    }),
  );

  return unflattenedRes.flat();
};

export default getRepoList;
