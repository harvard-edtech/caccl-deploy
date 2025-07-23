import type { EcrImage } from '../../shared/types/EcrImage.js';

/**
 * Split an ECR ARN value into parts. For example the ARN
 * "arn:aws:ecr:us-east-1:12345678901:repository/foo/tool:1.0.0"
 * would return
 * {
 *   service: ecr,
 *   region: us-east-1,
 *   account: 12345678901,
 *   repoName: foo/tool,
 *   imageTag: 1.0.0
 * }
 * @author Jay Luker
 * @param  {string} arn - an ECR ARN value
 * @returns {EcrImage} an object representing the parsed ECR image ARN
 */
const parseEcrArn = (arn: string): EcrImage => {
  const parts = arn.split(':');
  const account = parts[4];
  const region = parts[3];
  const service = parts[2];
  const [relativeId, imageTag] = parts.slice(-2);

  if (!relativeId) {
    throw new Error(`Invalid ECR ARN: ${arn}`);
  }

  const repoName = relativeId.replace('repository/', '');

  if (!account || !region || !service || !repoName || !imageTag) {
    throw new Error(`Invalid ECR ARN: ${arn}`);
  }

  return {
    account,
    imageTag,
    region,
    repoName,
    service,
  };
};

export default parseEcrArn;
