import { Flags } from '@oclif/core';
import yn from 'yn';

import SSM_PORT_FORWARDING_SESSION_DOCUMENT from '../aws/constants/SSM_PORT_FORWARDING_SESSION_DOCUMENT.js';
import { getCfnStackExports, resolveSecret } from '../aws/index.js';
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
    'service': Flags.string({
      char: 's',
      description:
        'service to connect to; use `--list` to see what is available',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const { list, 'local-port': localPortFlag, service } = this.flags;
    const { profile } = this.context;

    if (!list && !service) {
      this.exitWithError('One of `--list` or `--service` is required');
    }

    const deployConfig = await this.getDeployConfig(profile);

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
    const cfnStackExports = await getCfnStackExports(cfnStackName, profile);

    const {
      bastionHostId,
      cacheEndpoint,
      dbClusterEndpoint,
      dbPasswordSecretArn,
    } = cfnStackExports;

    if (dbPasswordSecretArn === undefined) {
      this.exitWithError(
        `database password secret ARN not found in CloudFormation stack exports for ${cfnStackName}`,
      );
    }

    let endpoint;
    let localPort;
    let remotePort;
    let clientCommand;

    if (['docdb', 'mysql'].includes(service)) {
      endpoint = dbClusterEndpoint;
      const password = await resolveSecret(dbPasswordSecretArn!, profile);
      if (service === 'mysql') {
        remotePort = '3306';
        localPort = localPortFlag || remotePort;
        clientCommand = `mysql -uroot -p${password} --port ${localPort} -h 127.0.0.1`;
      } else {
        remotePort = '27017';
        localPort = localPortFlag || remotePort;
        const tlsOpts =
          '--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates';
        clientCommand = `mongo ${tlsOpts} --username root --password ${password} --port ${localPort}`;
      }
    } else if (service === 'redis') {
      endpoint = cacheEndpoint;
      remotePort = '6379';
      localPort = localPortFlag || remotePort;
      clientCommand = `redis-cli -p ${localPort}`;
    } else {
      this.exitWithError(`not sure what to do with ${service}`);
    }

    const tunnelCommand = [
      'aws ssm start-session',
      `--target ${bastionHostId}`,
      `--document-name ${SSM_PORT_FORWARDING_SESSION_DOCUMENT}`,
      `--parameters '{"portNumber":["${remotePort}"],"localPortNumber":["${localPort}"],"host":["${
        endpoint?.split(':')[0]
      }"]}'`,
    ].join(' ');

    this.exitWithSuccess(
      [
        'A port-forwarding session can be created using the following tunnel command;',
        `This will allow you to connect to the ${service} service using the client command below.`,
        '',
        `# tunnel command:\n${tunnelCommand}\n`,
        `# ${service} client command:\n${clientCommand}`,
      ].join('\n'),
    );
  }
}
