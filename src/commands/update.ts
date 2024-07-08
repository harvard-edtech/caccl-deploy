// Import oclif
import { Args, Flags } from '@oclif/core'

// Import base command
import { BaseCommand } from '../base.js';

// Import config prompts
import { confirmProductionOp } from '../configPrompts/index.js';

// Import deploy config
import DeployConfig from '../deployConfig/index.js';

// Import helpers
import exitWithError from '../helpers/exitWithError.js';
import exitWithSuccess from '../helpers/exitWithSuccess.js';
import validSSMParamName from '../shared/helpers/validSSMParamName.js';


export default class Update extends BaseCommand<typeof Update> {
  static override description = 'update (or delete) a single deploy config setting';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override args = {
    param: Args.string({description: 'parameter to update'}),
    value: Args.string({description: 'value update the parameter to'}),
  }

  static override flags = {
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
    'delete': Flags.boolean({
      char: 'D',
      description: 'delete the named parameter instead of creating/updating',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      yes,
    } = this.flags;

    const assumedRole = this.getAssumedRole()
    const deployConfig = await this.getDeployConfig(assumedRole, true);

    if (!(await confirmProductionOp(yes))) {
      exitWithSuccess();
    }

    try {
      const { param, value } = this.args;
  
      if (this.flags.delete && param) {
        await DeployConfig.deleteParam(deployConfig, this.getAppPrefix(), param);
      } else if (param && value) {
        if (!validSSMParamName(param)) {
          throw new Error(`Invalid param name: '${param}'`);
        }
        await DeployConfig.update({
          deployConfig, 
          appPrefix: this.getAppPrefix(),
          param,
          value,
        });
      } else {
        // TODO: throw error?
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `${err}`;
      exitWithError(`Something went wrong: ${message}`);
    }
  }
}
