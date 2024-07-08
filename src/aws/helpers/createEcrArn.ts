// Import types
import EcrImage from '../../shared/types/EcrImage.js';

/**
 * Reassembles the result of `parseEcrArn` into a string.
 * @author Jay Luker
 * @param {EcrImage} ecrImage
 * @returns {string} an ECR image ARN
 */
const createEcrArn = (ecrImage: Omit<EcrImage, 'service'>): string => {
  return [
    'arn:aws:ecr',
    ecrImage.region,
    ecrImage.account,
    `repository/${ecrImage.repoName}`,
    ecrImage.imageTag,
  ].join(':');
};

export default createEcrArn;
