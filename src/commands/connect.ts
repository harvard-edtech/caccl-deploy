import { Flags } from '@oclif/core';
import untildify from 'untildify';
import yn from 'yn';

import {
  EC2_INSTANCE_CONNECT_USER,
  getCfnStackExports,
  resolveSecret,
  sendSSHPublicKey,
} from '../aws/index.js';
// Import base command
import { BaseCommand } from '../base.js';

// eslint-disable-next-line no-use-before-define
export default class Connect extends BaseCommand<typeof Connect> {
  static override description =
    "connect to an app's peripheral services (db, redis, etc)";

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
    'list': Flags.boolean({
      char: 'l',
      default: false,
      description: 'list the things to connect to',
    }),
    'local-port': Flags.string({
      description: 'attach tunnel to a non-default local port',
    }),
    'public-key': Flags.string({
      char: 'k',
      default: untildify('~/.ssh/id_rsa.pub'),
      description: 'path to the ssh public key file to use',
    }),
    'quiet': Flags.boolean({
      char: 'q',
      default: false,
      description: 'output only the ssh tunnel command',
    }),
    'service': Flags.string({
      char: 's',
      description:
        'service to connect to; use `--list` to see what is available',
      required: true,
    }),
    'sleep': Flags.string({
      char: 'S',
      default: '60',
      description: 'keep the tunnel alive for this long without activity',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      list,
      'local-port': localPortFlag,
      'public-key': publicKey,
      quiet,
      service,
      sleep,
    } = this.flags;

    const assumedRole = this.getAssumedRole();

    if (!list && !service) {
      this.exitWithError('One of `--list` or `--service` is required');
    }

    const deployConfig = await this.getDeployConfig(assumedRole);

    const services = new Set();
    for (const optsKey of ['dbOptions' as const, 'cacheOptions' as const]) {
      const serviceOptions = deployConfig[optsKey];
      if (serviceOptions) {
        services.add(serviceOptions.engine);
      }
    }

    if (yn(deployConfig.docDb)) {
      this.exitWithError(
        [
          'Deployment configuration is out-of-date',
          'Replace `docDb*` with `dbOptions: {...}`',
        ].join('\n'),
      );
    }

    if (list) {
      this.exitWithSuccess(
        ['Valid `--service=` options:', ...services].join('\n  '),
      );
    }

    if (!services.has(service)) {
      this.exitWithError(`'${service}' is not a valid option`);
    }

    const cfnStackName = this.getCfnStackName();
    const cfnStackExports = await getCfnStackExports(cfnStackName);

    const {
      bastionHostAz,
      bastionHostId,
      bastionHostIp,
      cacheEndpoint,
      dbClusterEndpoint,
      dbPasswordSecretArn,
    } = cfnStackExports;

    try {
      await sendSSHPublicKey({
        instanceAz: bastionHostAz,
        instanceId: bastionHostId,
        sshKeyPath: publicKey,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Could not send SSH public key: ${error}`;
      this.exitWithError(message);
    }

    let endpoint;
    let localPort;
    let clientCommand;

    if (['docdb', 'mysql'].includes(service)) {
      endpoint = dbClusterEndpoint;
      const password = await resolveSecret(dbPasswordSecretArn);
      if (service === 'mysql') {
        localPort = localPortFlag || '3306';
        clientCommand = `mysql -uroot -p${password} --port ${localPort} -h 127.0.0.1`;
      } else {
        localPort = localPortFlag || '27017';
        const tlsOpts =
          '--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates';
        clientCommand = `mongo ${tlsOpts} --username root --password ${password} --port ${localPort}`;
      }
    } else if (service === 'redis') {
      endpoint = cacheEndpoint;
      localPort = localPortFlag || '6379';
      clientCommand = `redis-cli -p ${localPort}`;
    } else {
      this.exitWithError(`not sure what to do with ${service}`);
    }

    const tunnelCommand = [
      'ssh -f -L',
      `${localPortFlag || localPort}:${endpoint}`,
      '-o StrictHostKeyChecking=no',
      `${EC2_INSTANCE_CONNECT_USER}@${bastionHostIp}`,
      `sleep ${sleep}`,
    ].join(' ');

    if (quiet) {
      this.exitWithSuccess(tunnelCommand);
    }

    this.exitWithSuccess(
      [
        `Your public key, ${publicKey}, has temporarily been placed on the bastion instance`,
        'You have ~60s to establish the ssh tunnel',
        '',
        `# tunnel command:\n${tunnelCommand}`,
        `# ${service} client command:\n${clientCommand}`,
      ].join('\n'),
    );
  }
}
