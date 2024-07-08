// Import oclif
import { Flags } from '@oclif/core';

import { BaseCommand } from '../base.js';

// Import aws
import { execTask, getCfnStackExports } from '../aws/index.js';

import { confirmProductionOp } from '../configPrompts/index.js';


import exitWithSuccess from '../helpers/exitWithSuccess.js';

// TODO: pull out into type (also in execTask)
type EnvVariable = {
  name: string,
  value: string,
};

// TODO: pull out into helper
const envVarParser = (inputs: string[] | undefined): EnvVariable[] => {
  if (!inputs) {
    return [];
  }
  return inputs.map((envVar: string): EnvVariable => {
    const [key, value] = envVar.split('=');
    return {
      name: key,
      value: value,
    };
  });
};

export default class Exec extends BaseCommand<typeof Exec> {
  static override description = 'execute a one-off task using the app image';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override flags = {
    name: Flags.string({char: 'n', description: 'name to print'}),
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
    'command': Flags.string({
      char: 'c',
      description: 'the app task command to run',
      required: true,
    }),
    'env': Flags.string({
      char: 'e',
      description: 'add or override container environment variables',
      multiple: true,
    })
  }

  public async run(): Promise<void> {
    const {
      command,
      env,
      yes,
    } = this.flags;

    const cfnStackName = this.getCfnStackName();
    const { appOnlyTaskDefName, clusterName, serviceName } =
      await getCfnStackExports(cfnStackName);

    // check that we're not using a wildly different version of the cli
    if (!yes && !(await this.stackVersionDiffCheck())) {
      exitWithSuccess();
    }
    if (!(await confirmProductionOp(yes))) {
      exitWithSuccess();
    }

    console.log(
      `Running command '${
        command
      }' on service ${serviceName} using task def ${appOnlyTaskDefName}`,
    );
    const taskArn = await execTask({
      clusterName,
      serviceName,
      taskDefName: appOnlyTaskDefName,
      command: command,
      environment: envVarParser(env),
    });
    exitWithSuccess(`Task ${taskArn} started`);
  }
}
