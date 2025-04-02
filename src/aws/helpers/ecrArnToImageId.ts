import parseEcrArn from './parseEcrArn.js';

/**
 * Transforms an ECR ARN value into it's URI form
 * for example, this:
 *   arn:aws:ecr:us-east-1:12345678901:repository/foo/tool:1.0.0
 * becomes this:
 *   12345678901.dkr.ecr.us-east-1.amazonaws.com/foo/tool
 * @author Jay Luker
 * @param {string} arn - an ECR ARN value
 * @returns {string} and ECR image URI
 */
const ecrArnToImageId = (arn: string): string => {
  const parsedArn = parseEcrArn(arn);
  const host = [
    parsedArn.account,
    'dkr.ecr',
    parsedArn.region,
    'amazonaws.com',
  ].join('.');
  return `${host}/${parsedArn.repoName}:${parsedArn.imageTag}`;
};

export default ecrArnToImageId;
