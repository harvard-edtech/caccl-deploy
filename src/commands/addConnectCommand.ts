import untildify from 'untildify';

import CacclDeployCommander from './classes/CacclDeployCommander';

import connectOperation from './operations/connectOperation';

const addConnectCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('connect')
    .description("connect to an app's peripheral services (db, redis, etc)")
    .appOption()
    .option('-l, --list', 'list the things to connect to')
    .option(
      '-s, --service <string>',
      'service to connect to; use `--list` to see what is available',
    )
    .option(
      '-k, --public-key <string>',
      'path to the ssh public key file to use',
      untildify('~/.ssh/id_rsa.pub'),
    )
    .option(
      '--local-port <string>',
      'attach tunnel to a non-default local port',
    )
    .option('-q, --quiet', 'output only the ssh tunnel command')
    .option(
      '-S, --sleep <string>',
      'keep the tunnel alive for this long without activity',
      '60',
    )
    .action(connectOperation);
};

export default addConnectCommand;
