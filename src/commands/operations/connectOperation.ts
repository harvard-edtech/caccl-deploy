import {
  EC2_INSTANCE_CONNECT_USER,
  getCfnStackExports,
  resolveSecret,
  sendSSHPublicKey,
} from '../../aws';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const connectOperation = async (cmd: CacclDeployCommander) => {
  if (!cmd.list && !cmd.service) {
    exitWithError('One of `--list` or `--service` is required');
  }

  const deployConfig = await cmd.getDeployConfig();

  const services = new Set();
  ['dbOptions', 'cacheOptions'].forEach((optsKey) => {
    if (deployConfig[optsKey]) {
      services.add(deployConfig[optsKey].engine);
    }
  });
  if (yn(deployConfig.docDb)) {
    exitWithError(
      [
        'Deployment configuration is out-of-date',
        'Replace `docDb*` with `dbOptions: {...}`',
      ].join('\n'),
    );
  }

  if (cmd.list) {
    exitWithSuccess(['Valid `--service=` options:', ...services].join('\n  '));
  }

  if (!services.has(cmd.service)) {
    exitWithError(`'${cmd.service}' is not a valid option`);
  }

  const cfnStackName = cmd.getCfnStackName();
  const cfnStackExports = await getCfnStackExports(cfnStackName);

  const { bastionHostAz, bastionHostId, bastionHostIp, dbPasswordSecretArn } =
    cfnStackExports;

  try {
    await sendSSHPublicKey({
      instanceAz: bastionHostAz,
      instanceId: bastionHostId,
      sshKeyPath: cmd.publicKey,
    });
  } catch (err) {
    exitWithError(err.message);
  }

  let endpoint;
  let localPort;
  let clientCommand;

  if (['mysql', 'docdb'].includes(cmd.service)) {
    endpoint = cfnStackExports.dbClusterEndpoint;
    const password = await resolveSecret(dbPasswordSecretArn);
    if (cmd.service === 'mysql') {
      localPort = cmd.localPort || '3306';
      clientCommand = `mysql -uroot -p${password} --port ${localPort} -h 127.0.0.1`;
    } else {
      localPort = cmd.localPort || '27017';
      const tlsOpts =
        '--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates';
      clientCommand = `mongo ${tlsOpts} --username root --password ${password} --port ${localPort}`;
    }
  } else if (cmd.service === 'redis') {
    endpoint = cfnStackExports.cacheEndpoint;
    localPort = cmd.localPort || '6379';
    clientCommand = `redis-cli -p ${localPort}`;
  } else {
    exitWithError(`not sure what to do with ${cmd.service}`);
  }

  const tunnelCommand = [
    'ssh -f -L',
    `${cmd.localPort || localPort}:${endpoint}`,
    '-o StrictHostKeyChecking=no',
    `${EC2_INSTANCE_CONNECT_USER}@${bastionHostIp}`,
    `sleep ${cmd.sleep}`,
  ].join(' ');

  if (cmd.quiet) {
    exitWithSuccess(tunnelCommand);
  }

  exitWithSuccess(
    [
      `Your public key, ${cmd.publicKey}, has temporarily been placed on the bastion instance`,
      'You have ~60s to establish the ssh tunnel',
      '',
      `# tunnel command:\n${tunnelCommand}`,
      `# ${cmd.service} client command:\n${clientCommand}`,
    ].join('\n'),
  );
};

export default connectOperation;
