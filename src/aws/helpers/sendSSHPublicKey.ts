// Import aws-sdk
import AWS from 'aws-sdk';

// Import shared helpers
import readFile from '../../shared/helpers/readFile';

export type SendSSHPublicKeyOpts = {
  instanceAz?: string;
  instanceId: string;
  sshKeyPath: string;
};

const sendSSHPublicKey = async (opts: SendSSHPublicKeyOpts) => {
  // Destructure opts
  const { instanceAz, instanceId, sshKeyPath } = opts;

  const ec2ic = new AWS.EC2InstanceConnect();
  const resp = await ec2ic
    .sendSSHPublicKey({
      AvailabilityZone: instanceAz,
      InstanceId: instanceId,
      InstanceOSUser: aws.EC2_INSTANCE_CONNECT_USER,
      SSHPublicKey: readFile(sshKeyPath),
    })
    .promise();
  return resp;
};

export default sendSSHPublicKey;
