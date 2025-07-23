/**
 * ECR image information.
 * @author Benedikt ARnarsson
 */
export type EcrImage = {
  account: string;
  imageTag: string;
  region: string;
  repoName: string;
  service: string;
};
