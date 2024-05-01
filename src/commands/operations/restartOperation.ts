import { getCfnStackExports, restartEcsService } from '../../aws';

import { confirmProductionOp } from '../../configPrompts';

import CfnStackNotFound from '../../shared/errors/CfnStackNotFound';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const restartOperation = async (cmd: any) => {
  const cfnStackName = cmd.getCfnStackName();
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

  if (!(await confirmProductionOp(cmd.yes))) {
    exitWithSuccess();
  }

  // restart the service
  await restartEcsService({
    cluster: clusterName,
    service: serviceName,
    wait: true,
  });
  exitWithSuccess('done');
};

export default restartOperation;
