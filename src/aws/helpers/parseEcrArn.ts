// Import types
import EcrImage from '../../shared/types/EcrImage.js';

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
  const [relativeId, imageTag] = parts.slice(-2);
  const repoName = relativeId.replace('repository/', '');
  return {
    account: parts[4],
    imageTag,
    region: parts[3],
    repoName,
    service: parts[2],
  };
};

export default parseEcrArn;
