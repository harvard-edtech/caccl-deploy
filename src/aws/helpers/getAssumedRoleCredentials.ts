import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';

import CacclDeployContext from '../../types/CacclDeployContext.js';
import getAccountId from './getAccountId.js';

// Constants
const ROLE_SESSION_NAME = 'caccl-deploy-assume-role-session';

// Types
type AssumedRoleCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

/**
 * Retrieve the credentials for an assumed role.
 * @author Benedikt Arnarsson
 * @param context CacclDeployContext
 * @returns the assumed role credentials for constructing AWS clients.
 */
const getAssumedRoleCredentials = async (
  context: CacclDeployContext,
): Promise<AssumedRoleCredentials | Record<string, never>> => {
  const { ecrAccessRoleArn, profile } = context;
  if (!ecrAccessRoleArn) {
    return {};
  }

  const accountId = await getAccountId(profile);
  if (ecrAccessRoleArn.includes(accountId)) {
    return {};
  }

  const client = new STSClient({
    profile,
  });

  const command = new AssumeRoleCommand({
    RoleArn: ecrAccessRoleArn,
    RoleSessionName: ROLE_SESSION_NAME,
  });

  const res = await client.send(command);
  const credentials = res.Credentials;
  if (!credentials) {
    throw new Error(
      `Could not retrieve credentials for assumed role: ${ecrAccessRoleArn}`,
    );
  }

  if (
    credentials.AccessKeyId &&
    credentials.SecretAccessKey &&
    credentials.SessionToken
  ) {
    return {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    };
  }

  return {};
};

export default getAssumedRoleCredentials;
