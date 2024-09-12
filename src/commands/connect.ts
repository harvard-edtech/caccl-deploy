import { Flags } from '@oclif/core'

import yn from 'yn';
import untildify from 'untildify';


import {
  EC2_INSTANCE_CONNECT_USER,
  getCfnStackExports,
  resolveSecret,
  sendSSHPublicKey,
} from '../aws/index.js';

// Import base command
import { BaseCommand } from '../base.js';


export default class Connect extends BaseCommand<typeof Connect> {
  static override description = "connect to an app's peripheral services (db, redis, etc)";

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
    'list': Flags.boolean({
      char: 'l',
      default: false,
      description: 'list the things to connect to',
    }),
    'service': Flags.string({
      char: 's',
      description: 'service to connect to; use `--list` to see what is available',
      required: true,
    }),
    'public-key': Flags.string({
      char: 'k',
      description: 'path to the ssh public key file to use',
      default: untildify('~/.ssh/id_rsa.pub'),
    }),
    'local-port': Flags.string({
      description: 'attach tunnel to a non-default local port',
    }),
    'quiet': Flags.boolean({
      char: 'q',
      description: 'output only the ssh tunnel command',
      default: false,
    }),
    'sleep': Flags.string({
      char: 'S',
      description: 'keep the tunnel alive for this long without activity',
      default: '60',
    }),
  }

  public async run(): Promise<void> {
    // Destructure flags
    const {
      'local-port': localPortFlag,
      'public-key': publicKey,
      quiet,
      list,
      service,
      sleep,
    } = this.flags;

    const assumedRole = this.getAssumedRole();

    if (!list && !service) {
      this.exitWithError('One of `--list` or `--service` is required');
    }

    const deployConfig = await this.getDeployConfig(assumedRole);

    const services = new Set();
    ['dbOptions' as const, 'cacheOptions' as const].forEach((optsKey) => {
      const serviceOptions = deployConfig[optsKey];
      if (serviceOptions) {
        services.add(serviceOptions.engine);
      }
    });
    if (yn(deployConfig.docDb)) {
      this.exitWithError(
        [
          'Deployment configuration is out-of-date',
          'Replace `docDb*` with `dbOptions: {...}`',
        ].join('\n'),
      );
    }

    if (list) {
      this.exitWithSuccess(['Valid `--service=` options:', ...services].join('\n  '));
    }

    if (!services.has(service)) {
      this.exitWithError(`'${service}' is not a valid option`);
    }

    const cfnStackName = this.getCfnStackName();
    const cfnStackExports = await getCfnStackExports(cfnStackName);

    const { bastionHostAz, bastionHostId, bastionHostIp, dbPasswordSecretArn } =
      cfnStackExports;

    try {
      await sendSSHPublicKey({
        instanceAz: bastionHostAz,
        instanceId: bastionHostId,
        sshKeyPath: publicKey,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Could not send SSH public key: ${err}`;
      this.exitWithError(message);
    }

    let endpoint;
    let localPort;
    let clientCommand;

    if (['mysql', 'docdb'].includes(service)) {
      endpoint = cfnStackExports.dbClusterEndpoint;
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
      endpoint = cfnStackExports.cacheEndpoint;
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
