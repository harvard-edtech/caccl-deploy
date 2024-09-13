// Import oclif
import { Args, Flags } from '@oclif/core';

// Import base command
import { BaseCommand } from '../base.js';
// Import config prompts
import { confirmProductionOp } from '../configPrompts/index.js';
// Import deploy config
import DeployConfig from '../deployConfig/index.js';
// Import helpers
import validSSMParamName from '../shared/helpers/validSSMParamName.js';

// eslint-disable-next-line no-use-before-define
export default class Update extends BaseCommand<typeof Update> {
  static override args = {
    param: Args.string({ description: 'parameter to update' }),
    value: Args.string({ description: 'value update the parameter to' }),
  };

  static override description =
    'update (or delete) a single deploy config setting';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    app: Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
    delete: Flags.boolean({
      char: 'D',
      description: 'delete the named parameter instead of creating/updating',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const { yes } = this.flags;

    const assumedRole = this.getAssumedRole();
    const deployConfig = await this.getDeployConfig(assumedRole, true);

    if (!(await confirmProductionOp(yes))) {
      this.exitWithSuccess();
    }

    try {
      const { param, value } = this.args;

      if (this.flags.delete && param) {
        await DeployConfig.deleteParam(
          deployConfig,
          this.getAppPrefix(),
          param,
        );
      } else if (param && value) {
        if (!validSSMParamName(param)) {
          throw new Error(`Invalid param name: '${param}'`);
        }

        await DeployConfig.update({
          appPrefix: this.getAppPrefix(),
          deployConfig,
          param,
          value,
        });
      } else {
        // TODO: throw error?
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      this.exitWithError(`Something went wrong: ${message}`);
    }
  }
}
