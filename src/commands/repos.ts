import { table } from 'table';

import { getRepoList } from '../aws/index.js';
import { BaseCommand } from '../base.js';

// eslint-disable-next-line no-use-before-define
export default class Repos extends BaseCommand<typeof Repos> {
  static override description = 'list the available ECR repositories';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  public async run(): Promise<void> {
    const repos = await getRepoList(this.context);
    const data = repos.map((r) => {
      return [r];
    });

    if (data.length > 0) {
      const tableOutput = table([['Repository Name'], ...data]);
      this.exitWithSuccess(tableOutput);
    }

    this.exitWithError('No ECR repositories found');
  }
}
