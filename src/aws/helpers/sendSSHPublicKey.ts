// Import aws-sdk
import AWS from 'aws-sdk';

// Import shared helpers
import readFile from '../../shared/helpers/readFile';

// Import constants
import EC2_INSTANCE_CONNECT_USER from '../constants/EC2_INSTANCE_CONNECT_USER';

export type SendSSHPublicKeyOpts = {
  instanceAz?: string;
  instanceId: string;
  sshKeyPath: string;
};

/**
 * Send SSH public key to a remote server.
 * @author Jay Luker
 * @param opts
 * @returns
 */
const sendSSHPublicKey = async (opts: SendSSHPublicKeyOpts) => {
  // Destructure opts
  const { instanceAz, instanceId, sshKeyPath } = opts;

  const ec2ic = new AWS.EC2InstanceConnect();
  const resp = await ec2ic
    .sendSSHPublicKey({
      AvailabilityZone: instanceAz,
      InstanceId: instanceId,
      InstanceOSUser: EC2_INSTANCE_CONNECT_USER,
      SSHPublicKey: readFile(sshKeyPath),
    })
    .promise();
  return resp;
};

export default sendSSHPublicKey;
