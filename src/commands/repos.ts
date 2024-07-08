// Import table
import { table } from 'table';

// Import aws helpers
import {
  getRepoList,
} from '../aws/index.js';

// Import base command
import { BaseCommand } from '../base.js'

// Import helpers
import exitWithError from '../helpers/exitWithError.js';
import exitWithSuccess from '../helpers/exitWithSuccess.js';

export default class Repos extends BaseCommand<typeof Repos> {
  static override description = 'list the available ECR repositories';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    const assumedRole = this.getAssumedRole();
    // see the README section on cross-account ECR access
    if (this.ecrAccessRoleArn !== undefined) {
      assumedRole.setAssumedRoleArn(this.ecrAccessRoleArn);
    }
    const repos = await getRepoList(assumedRole);
    const data = repos.map((r) => {
      return [r];
    });

    if (data.length) {
      const tableOutput = table([['Respository Name'], ...data]);
      exitWithSuccess(tableOutput);
    }
    exitWithError('No ECR repositories found');
  }
}
