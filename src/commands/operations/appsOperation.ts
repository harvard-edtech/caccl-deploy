// Import table
import { table } from 'table';

// Import aws
import { getAppList, getCfnStacks } from '../../aws';

// Import deploy config
import DeployConfig from '../../deployConfig';

// Import classes
import CacclDeployCommander from '../classes/CacclDeployCommander';

// Import helpers
import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const appsOperation = async (cmd: CacclDeployCommander) => {
  const apps = await getAppList(cmd.ssmRootPrefix);

  if (!apps.length) {
    exitWithError(
      `No app configurations found using ssm root prefix ${cmd.ssmRootPrefix}`,
    );
  }

  const appData = {};
  const tableColumns = ['App'];

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    appData[app] = [];
  }

  if (cmd.fullStatus) {
    tableColumns.push(
      'Infra Stack',
      'Stack Status',
      'Config Drift',
      'caccl-deploy Version',
    );
    const cfnStacks = await getCfnStacks(cmd.cfnStackPrefix);

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const cfnStackName = cmd.getCfnStackName(app);

      const appPrefix = cmd.getAppPrefix(app);
      const deployConfig = await DeployConfig.fromSsmParams(appPrefix);
      appData[app].push(deployConfig.infraStackName);

      const cfnStack = cfnStacks.find((s) => {
        return (
          s.StackName === cfnStackName && s.StackStatus !== 'DELETE_COMPLETE'
        );
      });
      if (!cfnStack) {
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
        return o.OutputKey.startsWith('DeployConfigHash');
      });

      if (cfnStackDeployConfigHashOutput) {
        const deployConfigHash = DeployConfig.toHash(deployConfig);
        const cfnOutputValue = cfnStackDeployConfigHashOutput.OutputValue;
        configDrift = cfnOutputValue !== deployConfigHash ? 'yes' : 'no';
      }
      appData[app].push(cfnStack.StackStatus, configDrift);

      const cfnStackCacclDeployVersion = cfnStack.Outputs.find((o) => {
        return o.OutputKey.startsWith('CacclDeployVersion');
      });
      appData[app].push(cfnStackCacclDeployVersion.OutputValue);
    }
  }
  const tableData = Object.keys(appData).map((app) => {
    return [app, ...appData[app]];
  });

  exitWithSuccess(table([tableColumns, ...tableData]));
};

export default appsOperation;
