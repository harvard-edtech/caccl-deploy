// Import oclif
import { Flags } from '@oclif/core'

// Import base command
import { BaseCommand } from '../base.js';

// Import aws helpers
import { cfnStackExists } from '../aws/index.js';

// Import config prompts
import { confirm, confirmProductionOp } from '../configPrompts/index.js';

// Import deploy config
import DeployConfig from '../deployConfig/index.js';

// Import errors
import AppNotFound from '../shared/errors/AppNotFound.js';


export default class Delete extends BaseCommand<typeof Delete> {
  static override description = 'delete an app configuration';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
  }

  public async run(): Promise<void> {
    // Destructure flags
    const {
      app,
      yes,
    } = this.flags;
  
    const cfnStackName = this.getCfnStackName();
    if (await cfnStackExists(cfnStackName)) {
      this.exitWithError(
        [
          `You must first run "caccl-deploy stack -a ${app} destroy" to delete`,
          `the deployed ${cfnStackName} CloudFormation stack before deleting it's config.`,
        ].join('\n'),
      );
    }

    try {
      this.log(`This will delete all deployment configuation for ${app}`);

      if (!(yes || (await confirm('Are you sure?')))) {
        this.exitWithSuccess();
      }
      // extra confirm if this is a production deployment
      if (!(await confirmProductionOp(yes))) {
        this.exitWithSuccess();
      }

      await DeployConfig.wipeExisting(this.getAppPrefix(), false);

      this.exitWithSuccess(`${app} configuration deleted`);
    } catch (err) {
      if (err instanceof AppNotFound) {
        this.exitWithError(`${app} app configuration not found!`);
      }
    }
  }
}
