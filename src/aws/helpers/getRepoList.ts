// Import aws-sdk
import AWS from 'aws-sdk';

// Import class
import getPaginatedResponse from './getPaginatedResponse.js';
import AssumedRole from '../classes/AssumedRole.js';

/**
 * @author Jay Luker
 * @returns {string[]} - array of ECR repository names
 */
const getRepoList = async (assumedRole: AssumedRole): Promise<string[]> => {
  const ecr = await assumedRole.getAssumedRoleClient(AWS.ECR);

  const repos = await getPaginatedResponse(
    ecr.describeRepositories.bind(ecr),
    {},
    'repositories',
  );

  const unflattenedRes = await Promise.all(
    repos.map(async (repo) => {
      const emptyArr: string[] = [];
      if (!repo.repositoryArn) return emptyArr;
      const tagResp = await ecr
        .listTagsForResource({
          resourceArn: repo.repositoryArn,
        })
        .promise();

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
