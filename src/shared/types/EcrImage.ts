/**
 * ECR image information.
 * @author Benedikt ARnarsson
 */
type EcrImage = {
  service: string;
  region: string;
  account: string;
  repoName: string;
  imageTag: string;
};

export default EcrImage;
