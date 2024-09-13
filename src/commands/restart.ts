// Import oclif
import { Flags } from '@oclif/core';

import { getCfnStackExports, restartEcsService } from '../aws/index.js';
// Import base command
import { BaseCommand } from '../base.js';
import { confirmProductionOp } from '../configPrompts/index.js';
import CfnStackNotFound from '../shared/errors/CfnStackNotFound.js';

// eslint-disable-next-line no-use-before-define
export default class Restart extends BaseCommand<typeof Restart> {
  static override description = 'no changes; just force a restart';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    app: Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const cfnStackName = this.getCfnStackName();
    let cfnExports;
    try {
      cfnExports = await getCfnStackExports(cfnStackName);
    } catch (error) {
      if (error instanceof CfnStackNotFound) {
        this.exitWithError(error.message);
      }

      throw error;
    }

    const { clusterName, serviceName } = cfnExports;
    this.log(`Restarting service ${serviceName} on cluster ${clusterName}`);

    if (!(await confirmProductionOp(this.flags.yes))) {
      this.exitWithSuccess();
    }

    // restart the service
    await restartEcsService({
      cluster: clusterName,
      service: serviceName,
      wait: true,
    });
    this.exitWithSuccess('done');
  }
}
