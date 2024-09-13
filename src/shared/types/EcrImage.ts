/**
 * ECR image information.
 * @author Benedikt ARnarsson
 */
type EcrImage = {
  account: string;
  imageTag: string;
  region: string;
  repoName: string;
  service: string;
};

export default EcrImage;
