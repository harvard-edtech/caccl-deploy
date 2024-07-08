// Import oclif
import { Flags } from '@oclif/core'

// Import base command
import { BaseCommand } from '../base.js';

import { getCfnStackExports, restartEcsService } from '../aws/index.js';

import { confirmProductionOp } from '../configPrompts/index.js';

import CfnStackNotFound from '../shared/errors/CfnStackNotFound.js';

import exitWithError from '../helpers/exitWithError.js';
import exitWithSuccess from '../helpers/exitWithSuccess.js';

export default class Restart extends BaseCommand<typeof Restart> {
  static override description = 'no changes; just force a restart';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
  };

  public async run(): Promise<void> {
    const cfnStackName = this.getCfnStackName();
    let cfnExports;
    try {
      cfnExports = await getCfnStackExports(cfnStackName);
    } catch (err) {
      if (err instanceof CfnStackNotFound) {
        exitWithError(err.message);
      }
      throw err;
    }
    const { clusterName, serviceName } = cfnExports;
    console.log(`Restarting service ${serviceName} on cluster ${clusterName}`);

    if (!(await confirmProductionOp(this.flags.yes))) {
      exitWithSuccess();
    }

    // restart the service
    await restartEcsService({
      cluster: clusterName,
      service: serviceName,
      wait: true,
    });
    exitWithSuccess('done');
  }
}
