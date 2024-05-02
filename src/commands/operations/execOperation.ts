// Import aws
import { execTask, getCfnStackExports } from '../../aws';

import { confirmProductionOp } from '../../configPrompts';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithSuccess from '../helpers/exitWithSuccess';

const execOperation = async (cmd: CacclDeployCommander) => {
  const cfnStackName = cmd.getCfnStackName();
  const { appOnlyTaskDefName, clusterName, serviceName } =
    await getCfnStackExports(cfnStackName);

  // check that we're not using a wildly different version of the cli
  if (!cmd.yes && !(await cmd.stackVersionDiffCheck())) {
    exitWithSuccess();
  }
  if (!(await confirmProductionOp(cmd.yes))) {
    exitWithSuccess();
  }

  console.log(
    `Running command '${
      cmd.opts().command
    }' on service ${serviceName} using task def ${appOnlyTaskDefName}`,
  );
  const taskArn = await execTask({
    clusterName,
    serviceName,
    taskDefName: appOnlyTaskDefName,
    command: cmd.opts().command,
    environment: cmd.opts().env,
  });
  exitWithSuccess(`Task ${taskArn} started`);
};

export default execOperation;
