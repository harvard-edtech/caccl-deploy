import { Flags } from '@oclif/core';

import { cfnStackExists } from '../aws/index.js';
import { BaseCommand } from '../base.js';
import { confirm, confirmProductionOp } from '../configPrompts/index.js';
import DeployConfig from '../deployConfig/index.js';
import AppNotFound from '../shared/errors/AppNotFound.js';

// eslint-disable-next-line no-use-before-define
export default class Delete extends BaseCommand<typeof Delete> {
  static override description = 'delete an app configuration';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    app: Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const { app } = this.flags;
    const { profile, yes } = this.context;

    const cfnStackName = this.getCfnStackName();
    if (await cfnStackExists(cfnStackName, profile)) {
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
      if (!(await confirmProductionOp(this.context))) {
        this.exitWithSuccess();
      }

      await DeployConfig.wipeExisting(this.getAppPrefix(), false, profile);

      this.exitWithSuccess(`${app} configuration deleted`);
    } catch (error) {
      if (error instanceof AppNotFound) {
        this.exitWithError(`${app} app configuration not found!`);
      }
    }
  }
}
