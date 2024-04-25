import { table } from 'table';

import { confirm } from '../../configPrompts';

import DeployConfig from '../../deployConfig';

import validSSMParamName from '../../shared/helpers/validSSMParamName';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const scheduleOperation = async (cmd: CacclDeployCommander) => {
  const deployConfig = await cmd.getDeployConfig();
  const existingTasks = deployConfig.scheduledTasks || {};
  const existingTaskIds = Object.keys(existingTasks);

  if (cmd.list) {
    // format existing as a table and exitWithSuccess
    if (existingTaskIds.length) {
      const tableRows = existingTaskIds.map((id) => {
        const taskSettings = existingTasks[id];
        const { command, schedule, description } = taskSettings;
        return [id, schedule, command, description];
      });
      const tableOutput = table([
        ['ID', 'Schedule', 'Command', 'Description'],
        ...tableRows,
      ]);
      exitWithSuccess(tableOutput);
    }
    exitWithSuccess('No scheduled tasks configured');
  } else if (cmd.delete) {
    // delete the existing entry
    if (!existingTaskIds.includes(cmd.delete)) {
      exitWithError(`No scheduled task with id ${cmd.delete}`);
    }
    const existingTask = existingTasks[cmd.delete];
    if (!(cmd.yes || (await confirm(`Delete scheduled task ${cmd.delete}?`)))) {
      exitWithSuccess();
    }
    const existingTaskParams = Object.keys(existingTask);
    for (let i = 0; i < existingTaskParams.length; i++) {
      await DeployConfig.deleteParam(
        deployConfig,
        cmd.getAppPrefix(),
        `scheduledTasks/${cmd.delete}/${existingTaskParams[i]}`,
      );
    }
    exitWithSuccess(`Scheduled task ${cmd.delete} deleted`);
  } else if (!(cmd.taskSchedule && cmd.taskCommand)) {
    exitWithError('Invalid options. See `--help` output');
  }

  const taskId = cmd.taskId || Math.random().toString(36).substr(2, 16);
  const taskDescription = cmd.taskDescription || '';
  const { taskSchedule } = cmd;
  const taskComman = cmd.taskCommand;

  if (!validSSMParamName(taskId)) {
    exitWithError(
      `Invalid ${taskId} value; '/^([a-z0-9:/_-]+)$/i' allowed only`,
    );
  }

  if (
    existingTaskIds.some((t) => {
      return t === taskId;
    })
  ) {
    exitWithError(
      `A schedule task with id ${taskId} already exists for ${cmd.app}`,
    );
  }

  const params = {
    [`scheduledTasks/${taskId}/description`]: taskDescription,
    [`scheduledTasks/${taskId}/schedule`]: taskSchedule,
    [`scheduledTasks/${taskId}/command`]: taskComman,
  };

  await DeployConfig.syncToSsm(deployConfig, cmd.getAppPrefix(), params);
  exitWithSuccess('task scheduled');
};

export default scheduleOperation;
