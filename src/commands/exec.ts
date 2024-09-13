// Import oclif
import { Flags } from '@oclif/core';

// Import aws
import { execTask, getCfnStackExports } from '../aws/index.js';
import { BaseCommand } from '../base.js';
import { confirmProductionOp } from '../configPrompts/index.js';

// TODO: pull out into type (also in execTask)
type EnvVariable = {
  name: string;
  value: string;
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
      value,
    };
  });
};

// eslint-disable-next-line no-use-before-define
export default class Exec extends BaseCommand<typeof Exec> {
  static override description = 'execute a one-off task using the app image';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    app: Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
    command: Flags.string({
      char: 'c',
      description: 'the app task command to run',
      required: true,
    }),
    env: Flags.string({
      char: 'e',
      description: 'add or override container environment variables',
      multiple: true,
    }),
    name: Flags.string({ char: 'n', description: 'name to print' }),
  };

  public async run(): Promise<void> {
    const { command, env, yes } = this.flags;

    const cfnStackName = this.getCfnStackName();
    const { appOnlyTaskDefName, clusterName, serviceName } =
      await getCfnStackExports(cfnStackName);

    // check that we're not using a wildly different version of the cli
    if (!yes && !(await this.stackVersionDiffCheck())) {
      this.exitWithSuccess();
    }

    if (!(await confirmProductionOp(yes))) {
      this.exitWithSuccess();
    }

    this.log(
      `Running command '${command}' on service ${serviceName} using task def ${appOnlyTaskDefName}`,
    );
    const taskArn = await execTask({
      clusterName,
      command,
      environment: envVarParser(env),
      serviceName,
      taskDefName: appOnlyTaskDefName,
    });
    this.exitWithSuccess(`Task ${taskArn} started`);
  }
}
