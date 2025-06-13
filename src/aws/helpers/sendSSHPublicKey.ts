import {
  EC2InstanceConnectClient,
  SendSSHPublicKeyCommand,
  SendSSHPublicKeyCommandOutput,
} from '@aws-sdk/client-ec2-instance-connect';

import readFile from '../../shared/helpers/readFile.js';
import EC2_INSTANCE_CONNECT_USER from '../constants/EC2_INSTANCE_CONNECT_USER.js';

export type SendSSHPublicKeyOpts = {
  instanceAz?: string;
  instanceId: string;
  profile?: string;
  sshKeyPath: string;
};

/**
 * Send SSH public key to a remote server.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {SendSSHPublicKeyOpts} opts send SSH public key options
 * @param {string} [opts.instanceAz] Availability zone for the EC2 instance.
 * @param {string} opts.instanceId ID for the EC2 instance.
 * @param {string} [opts.profile='default'] AWS profile for the EC2 instance.
 * @param {string} opts.sshKeyPath local path to the SSH key.
 * @returns {Promise<SendSSHPublicKeyCommandOutput>} results of the send SSH public key request.
 */
const sendSSHPublicKey = async (
  opts: SendSSHPublicKeyOpts,
): Promise<SendSSHPublicKeyCommandOutput> => {
  // Destructure opts
  const { instanceAz, instanceId, profile = 'default', sshKeyPath } = opts;

  const client = new EC2InstanceConnectClient({ profile });
  const command = new SendSSHPublicKeyCommand({
    AvailabilityZone: instanceAz,
    InstanceId: instanceId,
    InstanceOSUser: EC2_INSTANCE_CONNECT_USER,
    SSHPublicKey: readFile(sshKeyPath),
  });
  const resp = await client.send(command);
  return resp;
};

export default sendSSHPublicKey;
