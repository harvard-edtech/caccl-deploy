import { table } from 'table';

import {
  getRepoList,
  // setAssumedRoleArn,
} from '../../aws';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const reposOperation = async (cmd: CacclDeployCommander) => {
  const assumedRole = cmd.getAssumedRole();
  // see the README section on cross-account ECR access
  if (cmd.ecrAccessRoleArn !== undefined) {
    assumedRole.setAssumedRoleArn(cmd.ecrAccessRoleArn);
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
};

export default reposOperation;
