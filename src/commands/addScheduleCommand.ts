import CacclDeployCommander from './classes/CacclDeployCommander';

import scheduleOperation from './operations/scheduleOperation';

const addScheduleCommand = (
  cli: CacclDeployCommander,
): CacclDeployCommander => {
  return cli
    .command('schedule')
    .description(
      'create a scheduled task that executes the app image with a custom command',
    )
    .appOption()
    .option('-l, --list', 'list the existing scheduled tasks')
    .option(
      '-t, --task-id <string>',
      'give the task a string id; by default one will be generated',
    )
    .option(
      '-d, --task-description <string>',
      'description of what the task does',
    )
    .option('-D, --delete <string>', 'delete a scheduled task')
    .option(
      '-s, --task-schedule <string>',
      'a cron expression, e.g. "0 4 * * *"',
    )
    .option('-c, --task-command <string>', 'the app task command to run')
    .action(scheduleOperation);
};

export default addScheduleCommand;
