import { Flags } from '@oclif/core';
import { table } from 'table';

import { BaseCommand } from '../base.js';
import { confirm } from '../configPrompts/index.js';
import DeployConfig from '../deployConfig/index.js';
import validSSMParamName from '../shared/helpers/validSSMParamName.js';

// eslint-disable-next-line no-use-before-define
export default class Schedule extends BaseCommand<typeof Schedule> {
  static override description =
    'create a scheduled task that executes the app image with a custom command';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
    'delete': Flags.string({
      char: 'D',
      description: 'delete a scheduled task',
    }),
    'list': Flags.boolean({
      char: 'l',
      description: 'list the existing scheduled tasks',
    }),
    'task-command': Flags.string({
      char: 'c',
      description: 'the app task command to run',
    }),
    'task-description': Flags.string({
      char: 'd',
      description: 'description of what the task does',
    }),
    'task-id': Flags.string({
      char: 't',
      description:
        'give the task a string id; by default one will be generated',
    }),
    'task-schedule': Flags.string({
      char: 's',
      description: 'a cron expression, e.g. "0 4 * * *"',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      app,
      delete: deleteFlag,
      list,
      'task-command': taskCommand,
      'task-description': taskDescriptionFlag,
      'task-id': taskIdFlag,
      'task-schedule': taskSchedule,
    } = this.flags;
    const { profile, yes } = this.context;

    const deployConfig = await this.getDeployConfig(profile);
    const existingTasks = deployConfig.scheduledTasks || {};
    const existingTaskIds = Object.keys(existingTasks);

    if (list) {
      // format existing as a table and exitWithSuccess
      if (existingTaskIds.length > 0) {
        const tableRows = existingTaskIds.map((id) => {
          const taskSettings = existingTasks[id];
          // Defensive: taskSettings may be undefined
          const command = taskSettings?.command ?? '';
          const description = taskSettings?.description ?? '';
          const schedule = taskSettings?.schedule ?? '';
          return [id, schedule, command, description];
        });
        const tableOutput = table([
          ['ID', 'Schedule', 'Command', 'Description'],
          ...tableRows,
        ]);
        this.exitWithSuccess(tableOutput);
      }

      this.exitWithSuccess('No scheduled tasks configured');
    } else if (deleteFlag) {
      // delete the existing entry
      if (!existingTaskIds.includes(deleteFlag)) {
        this.exitWithError(`No scheduled task with id ${deleteFlag}`);
      }

      const existingTask = existingTasks[deleteFlag];
      if (!(yes || (await confirm(`Delete scheduled task ${deleteFlag}?`)))) {
        this.exitWithSuccess();
      }

      // Defensive: existingTask may be undefined, but we checked above that it exists in existingTaskIds
      const existingTaskParams = existingTask ? Object.keys(existingTask) : [];
      for (const existingTaskParam of existingTaskParams) {
        await DeployConfig.deleteParam({
          appPrefix: this.getAppPrefix(),
          deployConfig,
          param: `scheduledTasks/${deleteFlag}/${existingTaskParam}`,
          profile,
        });
      }

      this.exitWithSuccess(`Scheduled task ${deleteFlag} deleted`);
    } else if (!(taskSchedule && taskCommand)) {
      // FIXME: need to guarantee that this exits (throw an error?)
      this.exitWithError('Invalid options. See `--help` output');
    }

    const taskId = taskIdFlag || Math.random().toString(36).slice(2, 16);
    const taskDescription = taskDescriptionFlag || '';

    if (!validSSMParamName(taskId)) {
      this.exitWithError(
        `Invalid ${taskId} value; '/^([a-z0-9:/_-]+)$/i' allowed only`,
      );
    }

    if (existingTaskIds.includes(taskId)) {
      this.exitWithError(
        `A schedule task with id ${taskId} already exists for ${app}`,
      );
    }

    const params = {
      [`scheduledTasks/${taskId}/command`]: taskCommand ?? '', // FIXME:
      [`scheduledTasks/${taskId}/description`]: taskDescription,
      [`scheduledTasks/${taskId}/schedule`]: taskSchedule ?? '', // FIXME:
    };

    await DeployConfig.syncToSsm({
      appPrefix: this.getAppPrefix(),
      deployConfig,
      params,
      profile,
    });
    this.exitWithSuccess('task scheduled');
  }
}
