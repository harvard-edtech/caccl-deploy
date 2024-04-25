// Import classes
import AssumedRole from './classes/AssumedRole';

// Import constants
import EC2_INSTANCE_CONNECT_USER from './constants/EC2_INSTANCE_CONNECT_USER';

// Import helpers
import cfnStackExists from './helpers/cfnStackExists';
import createEcrArn from './helpers/createEcrArn';
import deleteSecrets from './helpers/deleteSecrets';
import deleteSsmParameters from './helpers/deleteSsmParameters';
import ecrArnToImageId from './helpers/ecrArnToImageId';
import execTask from './helpers/execTask';
import getAccountId from './helpers/getAccountId';
import getAcmCertList from './helpers/getAcmCertList';
import getAppList from './helpers/getAppList';
import getCfnStackExports from './helpers/getCfnStackExports';
import getCfnStacks from './helpers/getCfnStacks';
import getCurrentRegion from './helpers/getCurrentRegion';
import getInfraStackList from './helpers/getInfraStackList';
import getRepoImageList from './helpers/getRepoImageList';
import getRepoList from './helpers/getRepoList';
import getService from './helpers/getService';
import getSsmParametersByPrefix from './helpers/getSsmParametersByPrefix';
import getTaskDefinition from './helpers/getTaskDefinition';
import imageTagExists from './helpers/imageTagExists';
import initProfile from './helpers/initProfile';
import isConfigured from './helpers/isConfigured';
import isLatestTag from './helpers/isLatestTag';
import parseEcrArn from './helpers/parseEcrArn';
import putSecret from './helpers/putSecret';
import putSsmParameter from './helpers/putSsmParameter';
import resolveSecret from './helpers/resolveSecret';
import restartEcsService from './helpers/restartEcsService';
import secretExists from './helpers/secretExists';
import sendSSHPublicKey from './helpers/sendSSHPublicKey';
import updateTaskDefAppImage from './helpers/updateTaskDefAppImage';

// Set environment variables
process.env.AWS_SDK_LOAD_CONFIG = '1';

// TODO: potentially separate by service?
//  - ECR
//  - SSM
//  - CloudFormation
//  - SecretsManager
//  - ECS
//  - EC2InstanceConnect
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
