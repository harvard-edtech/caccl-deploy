import { Flags } from '@oclif/core';

import { execTask, getCfnStackExports } from '../aws/index.js';
import { BaseCommand } from '../base.js';
import {
  confirmProductionOp,
  stackVersionDiffCheck,
} from '../configPrompts/index.js';

// Types
type EnvVariable = {
  name: string;
  value: string;
};

// Helpers
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
    const { command, env } = this.flags;
    const { profile, yes } = this.context;

    const cfnStackName = this.getCfnStackName();
    const { appOnlyTaskDefName, clusterName, serviceName } =
      await getCfnStackExports(cfnStackName, profile);

    // check that we're not using a wildly different version of the cli
    if (
      !yes &&
      !(await stackVersionDiffCheck(this.getCfnStackName(), profile))
    ) {
      this.exitWithSuccess();
    }

    if (!(await confirmProductionOp(this.context))) {
      this.exitWithSuccess();
    }

    this.log(
      `Running command '${command}' on service ${serviceName} using task def ${appOnlyTaskDefName}`,
    );
    const taskArn = await execTask({
      clusterName,
      command,
      environment: envVarParser(env),
      profile,
      serviceName,
      taskDefName: appOnlyTaskDefName,
    });
    this.exitWithSuccess(`Task ${taskArn} started`);
  }
}
