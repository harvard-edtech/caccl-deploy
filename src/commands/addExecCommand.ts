import CacclDeployCommander from './classes/CacclDeployCommander';

import execOperation from './operations/execOperation';

const addExecCommand = (cli: CacclDeployCommander): CacclDeployCommander => {
  return cli
    .command('exec')
    .description('execute a one-off task using the app image')
    .appOption()
    .requiredOption('-c, --command <string>', 'the app task command to run')
    .option(
      '-e, --env <value>',
      'add or override container environment variables',
      (
        e: string,
        collected: { name: string; value: string }[],
      ): { name: string; value: string }[] => {
        const [k, v] = e.split('=');
        return collected.concat([
          {
            name: k,
            value: v,
          },
        ]);
      },
      [],
    )
    .action(execOperation);
};

export default addExecCommand;
