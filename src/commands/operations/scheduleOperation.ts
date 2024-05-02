import { table } from 'table';

import { confirm } from '../../configPrompts';

import DeployConfig from '../../deployConfig';

import validSSMParamName from '../../shared/helpers/validSSMParamName';

import CacclDeployCommander from '../classes/CacclDeployCommander';

import exitWithError from '../helpers/exitWithError';
import exitWithSuccess from '../helpers/exitWithSuccess';

const scheduleOperation = async (cmd: CacclDeployCommander) => {
  const opts = cmd.opts();
  const assumedRole = cmd.getAssumedRole();

  const deployConfig = await cmd.getDeployConfig(assumedRole);
  const existingTasks = deployConfig.scheduledTasks || {};
  const existingTaskIds = Object.keys(existingTasks);

  if (opts.list) {
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
  } else if (opts.delete) {
    // delete the existing entry
    if (!existingTaskIds.includes(cmd.delete)) {
      exitWithError(`No scheduled task with id ${cmd.delete}`);
    }
    const existingTask = existingTasks[cmd.delete];
    if (
      !(cmd.yes || (await confirm(`Delete scheduled task ${opts.delete}?`)))
    ) {
      exitWithSuccess();
    }
    const existingTaskParams = Object.keys(existingTask);
    for (let i = 0; i < existingTaskParams.length; i++) {
      await DeployConfig.deleteParam(
        deployConfig,
        cmd.getAppPrefix(),
        `scheduledTasks/${opts.delete}/${existingTaskParams[i]}`,
      );
    }
    exitWithSuccess(`Scheduled task ${opts.delete} deleted`);
  } else if (!(opts.taskSchedule && opts.taskCommand)) {
    exitWithError('Invalid options. See `--help` output');
  }

  const taskId = opts.taskId || Math.random().toString(36).substring(2, 16);
  const taskDescription = opts.taskDescription || '';
  const { taskCommand, taskSchedule } = opts;

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
      `A schedule task with id ${taskId} already exists for ${opts.app}`,
    );
  }

  const params = {
    [`scheduledTasks/${taskId}/description`]: taskDescription,
    [`scheduledTasks/${taskId}/schedule`]: taskSchedule,
    [`scheduledTasks/${taskId}/command`]: taskCommand,
  };

  await DeployConfig.syncToSsm(deployConfig, cmd.getAppPrefix(), params);
  exitWithSuccess('task scheduled');
};

export default scheduleOperation;
