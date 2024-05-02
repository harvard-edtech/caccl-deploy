import yn from 'yn';

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
  const opts = cmd.opts();
  const assumedRole = cmd.getAssumedRole();

  if (!opts.list && !opts.service) {
    exitWithError('One of `--list` or `--service` is required');
  }

  const deployConfig = await cmd.getDeployConfig(assumedRole);

  const services = new Set();
  ['dbOptions' as const, 'cacheOptions' as const].forEach((optsKey) => {
    const serviceOptions = deployConfig[optsKey];
    if (serviceOptions) {
      services.add(serviceOptions.engine);
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

  if (opts.list) {
    exitWithSuccess(['Valid `--service=` options:', ...services].join('\n  '));
  }

  if (!services.has(opts.service)) {
    exitWithError(`'${opts.service}' is not a valid option`);
  }

  const cfnStackName = cmd.getCfnStackName();
  const cfnStackExports = await getCfnStackExports(cfnStackName);

  const { bastionHostAz, bastionHostId, bastionHostIp, dbPasswordSecretArn } =
    cfnStackExports;

  try {
    await sendSSHPublicKey({
      instanceAz: bastionHostAz,
      instanceId: bastionHostId,
      sshKeyPath: opts.publicKey,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : `Could not send SSH public key: ${err}`;
    exitWithError(message);
  }

  let endpoint;
  let localPort;
  let clientCommand;

  if (['mysql', 'docdb'].includes(opts.service)) {
    endpoint = cfnStackExports.dbClusterEndpoint;
    const password = await resolveSecret(dbPasswordSecretArn);
    if (opts.service === 'mysql') {
      localPort = opts.localPort || '3306';
      clientCommand = `mysql -uroot -p${password} --port ${localPort} -h 127.0.0.1`;
    } else {
      localPort = opts.localPort || '27017';
      const tlsOpts =
        '--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates';
      clientCommand = `mongo ${tlsOpts} --username root --password ${password} --port ${localPort}`;
    }
  } else if (opts.service === 'redis') {
    endpoint = cfnStackExports.cacheEndpoint;
    localPort = opts.localPort || '6379';
    clientCommand = `redis-cli -p ${localPort}`;
  } else {
    exitWithError(`not sure what to do with ${opts.service}`);
  }

  const tunnelCommand = [
    'ssh -f -L',
    `${opts.localPort || localPort}:${endpoint}`,
    '-o StrictHostKeyChecking=no',
    `${EC2_INSTANCE_CONNECT_USER}@${bastionHostIp}`,
    `sleep ${opts.sleep}`,
  ].join(' ');

  if (opts.quiet) {
    exitWithSuccess(tunnelCommand);
  }

  exitWithSuccess(
    [
      `Your public key, ${opts.publicKey}, has temporarily been placed on the bastion instance`,
      'You have ~60s to establish the ssh tunnel',
      '',
      `# tunnel command:\n${tunnelCommand}`,
      `# ${opts.service} client command:\n${clientCommand}`,
    ].join('\n'),
  );
};

export default connectOperation;
