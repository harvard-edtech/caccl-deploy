import { table } from 'table';

import {
  getRepoList,
  // setAssumedRoleArn,
} from '../../aws';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const reposOperation = async (cmd) => {
  // see the README section on cross-account ECR access
  if (cmd.ecrAccessRoleArn !== undefined) {
    // setAssumedRoleArn(cmd.ecrAccessRoleArn);
  }
  const repos = await getRepoList();
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
