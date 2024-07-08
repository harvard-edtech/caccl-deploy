// Import classes
import AssumedRole from './classes/AssumedRole.js';

// Import constants
import EC2_INSTANCE_CONNECT_USER from './constants/EC2_INSTANCE_CONNECT_USER.js';

// Import helpers
import cfnStackExists from './helpers/cfnStackExists.js';
import createEcrArn from './helpers/createEcrArn.js';
import deleteSecrets from './helpers/deleteSecrets.js';
import deleteSsmParameters from './helpers/deleteSsmParameters.js';
import ecrArnToImageId from './helpers/ecrArnToImageId.js';
import execTask from './helpers/execTask.js';
import getAccountId from './helpers/getAccountId.js';
import getAcmCertList from './helpers/getAcmCertList.js';
import getAppList from './helpers/getAppList.js';
import getCfnStackExports from './helpers/getCfnStackExports.js';
import getCfnStacks from './helpers/getCfnStacks.js';
import getCurrentRegion from './helpers/getCurrentRegion.js';
import getInfraStackList from './helpers/getInfraStackList.js';
import getRepoImageList from './helpers/getRepoImageList.js';
import getRepoList from './helpers/getRepoList.js';
import getService from './helpers/getService.js';
import getSsmParametersByPrefix from './helpers/getSsmParametersByPrefix.js';
import getTaskDefinition from './helpers/getTaskDefinition.js';
import imageTagExists from './helpers/imageTagExists.js';
import initProfile from './helpers/initProfile.js';
import isConfigured from './helpers/isConfigured.js';
import isLatestTag from './helpers/isLatestTag.js';
import parseEcrArn from './helpers/parseEcrArn.js';
import putSecret from './helpers/putSecret.js';
import putSsmParameter from './helpers/putSsmParameter.js';
import resolveSecret from './helpers/resolveSecret.js';
import restartEcsService from './helpers/restartEcsService.js';
import secretExists from './helpers/secretExists.js';
import sendSSHPublicKey from './helpers/sendSSHPublicKey.js';
import updateTaskDefAppImage from './helpers/updateTaskDefAppImage.js';

// Set environment variables
process.env.AWS_SDK_LOAD_CONFIG = '1';
export {
  // Classes
  AssumedRole,
  // Constants
  EC2_INSTANCE_CONNECT_USER,
  // Helpers
  cfnStackExists, // CloudFormation
  createEcrArn, // ECR
  deleteSecrets, // SecretsManager
  deleteSsmParameters, // SSM
  ecrArnToImageId, // ECR
  execTask, // ECS
  getAccountId, // General
  getAcmCertList, // ACM
  getAppList, // SSM
  getCfnStackExports, // CloudFormation
  getCfnStacks, // CloudFormation
  getCurrentRegion, // General
  getInfraStackList, // CloudFormation
  getRepoImageList, // ECR
  getRepoList, // ECR
  getService, // ECS
  getSsmParametersByPrefix, // SSM
  getTaskDefinition, // ECS
  imageTagExists, // ECR
  initProfile, // General
  isConfigured, // General
  isLatestTag, // ECR
  parseEcrArn, // ECR
  putSecret, // SecretsManager
  putSsmParameter, // SSM
  resolveSecret, // SecretsManager
  secretExists, // SecretsManager
  restartEcsService, // ECS
  sendSSHPublicKey, // EC2
  updateTaskDefAppImage, // ECS
};
