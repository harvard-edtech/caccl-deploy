// Import aws-sdk
import AWS, { Service, STS } from 'aws-sdk';

// Import helpers
import getAccountId from '../helpers/getAccountId.js';

/**
 * Class for handling assumed IAM roles.
 * @author Benedikt Arnarsson
 */
class AssumedRole {
  private assumedRoleArn: string | undefined;

  private assumedRoleCredentials: STS.Credentials | undefined;

  public constructor() {
    this.assumedRoleArn = undefined;
  }

  /**
   * Set an IAM role for AWS clients to assume
   * @param {string} roleArn
   */
  public setAssumedRoleArn(roleArn: string) {
    this.assumedRoleArn = roleArn;
  }

  /**
   * Returns an AWS service client that has been reconfigured with
   * temporary credentials from assuming an IAM role
   * @param {class} ClientClass
   * @returns {object}
   */
  public async getAssumedRoleClient<TClient extends typeof Service>(
    ClientClass: TClient,
  ): Promise<InstanceType<TClient>> {
    const client = new ClientClass() as InstanceType<TClient>;
    if (
      this.assumedRoleArn === undefined ||
      this.assumedRoleArn.includes(await getAccountId())
    ) {
      return client;
    }
    if (this.assumedRoleCredentials === undefined) {
      const sts = new AWS.STS();
      const resp = await sts
        .assumeRole({
          RoleArn: this.assumedRoleArn,
          RoleSessionName: 'caccl-deploy-assume-role-session',
        })
        .promise();
      const credentials = resp.Credentials;
      if (!credentials) {
        throw new Error(
          `Could not retrieve credentials for assumed role: ${this.assumedRoleArn}`,
        );
      }
      this.assumedRoleCredentials = credentials;
    }
    client.config.update({
      accessKeyId: this.assumedRoleCredentials.AccessKeyId,
      secretAccessKey: this.assumedRoleCredentials.SecretAccessKey,
      sessionToken: this.assumedRoleCredentials.SessionToken,
    });
    return client;
  }
}

export default AssumedRole;
