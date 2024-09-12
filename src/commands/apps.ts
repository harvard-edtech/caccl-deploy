// Import oclif
import { Flags } from '@oclif/core';

// Import table
import { table } from 'table';

// Import aws
import { getAppList, getCfnStacks } from '../aws/index.js';

// Import base command
import { BaseCommand } from '../base.js';

// Import deploy config
import DeployConfig from '../deployConfig/index.js';


export default class Apps extends BaseCommand<typeof Apps> {
  static override description = 'list available app configurations';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --full-status',
  ];

  static override flags = {
    'full-status': Flags.boolean({
      char: 'f',
      aliases: ['full-status', 'f'],
      default: false,
      description: 'show the full status of each app including CFN stack and config state',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      'ssm-root-prefix': ssmRootPrefix,
      'cfn-stack-prefix': cfnStackPrefix,
      'full-status': fullStatus,
    } = this.flags;

    const apps = await getAppList(ssmRootPrefix);

    if (!apps.length) {
      this.exitWithError(
        `No app configurations found using ssm root prefix ${ssmRootPrefix}`,
      );
    }

    const appData: Record<string, string[]> = {};
    const tableColumns = ['App'];

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      appData[app] = [];
    }

    if (fullStatus) {
      tableColumns.push(
        'Infra Stack',
        'Stack Status',
        'Config Drift',
        'caccl-deploy Version',
      );
      const cfnStacks = await getCfnStacks(cfnStackPrefix);

      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        const cfnStackName = this.getCfnStackName(app);

        const appPrefix = this.getAppPrefix(app);
        const deployConfig = await DeployConfig.fromSsmParams(appPrefix);
        appData[app].push(deployConfig.infraStackName);

        const cfnStack = cfnStacks.find((s) => {
          return (
            s.StackName === cfnStackName && s.StackStatus !== 'DELETE_COMPLETE'
          );
        });
        if (!cfnStack || !cfnStack.Outputs) {
          // config exists but cfn stack not deployed yet (or was destroyed)
          appData[app].push('', '', '');
          continue;
        }

        /**
         * Compare a hash of the config used during stack deployment to the
         * has of the current config
         */
        let configDrift = '?';
        const cfnStackDeployConfigHashOutput = cfnStack.Outputs.find((o) => {
          return o.OutputKey && o.OutputKey.startsWith('DeployConfigHash');
        });

        if (cfnStackDeployConfigHashOutput) {
          const deployConfigHash = DeployConfig.toHash(deployConfig);
          const cfnOutputValue = cfnStackDeployConfigHashOutput.OutputValue;
          configDrift = cfnOutputValue !== deployConfigHash ? 'yes' : 'no';
        }
        appData[app].push(cfnStack.StackStatus, configDrift);

        const cfnStackCacclDeployVersion = cfnStack.Outputs.find((o) => {
          return o.OutputKey && o.OutputKey.startsWith('CacclDeployVersion');
        });
        appData[app].push(cfnStackCacclDeployVersion?.OutputValue ?? 'N/A');
      }
    }
    const tableData = Object.keys(appData).map((app) => {
      return [app, ...appData[app]];
    });

    this.exitWithSuccess(table([tableColumns, ...tableData]));
  }
}
