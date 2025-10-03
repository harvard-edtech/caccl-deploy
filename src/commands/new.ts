import { Flags } from '@oclif/core';
import chalk from 'chalk';
import figlet from 'figlet';
import { existsSync } from 'node:fs';

import { cfnStackExists, getAppList } from '../aws/index.js';
import { BaseCommand } from '../base.js';
import {
  confirm,
  confirmProductionOp,
  promptAppName,
} from '../configPrompts/index.js';
import DeployConfig from '../deployConfig/index.js';
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import UserCancel from '../shared/errors/UserCancel.js';
import DeployConfigData from '../types/DeployConfigData.js';

// eslint-disable-next-line no-use-before-define
export default class New extends BaseCommand<typeof New> {
  static override description =
    'create a new app deploy config via import and/or prompts';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    app: Flags.string({
      char: 'a',
      description: 'name of the app to work with',
    }),
    import: Flags.string({
      char: 'i',
      description: 'import new deploy config from a json file',
      async parse(input: string) {
        if (existsSync(input)) {
          return input;
        }

        throw new Error(`File does not exist ${input}`);
      },
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const { app, import: importFlag } = this.flags;
    const { profile, ssmRootPrefix, yes } = this.context;

    const existingApps = await getAppList(ssmRootPrefix, profile);

    let appName;
    try {
      appName = app || (await promptAppName());
    } catch (error) {
      if (error instanceof UserCancel) {
        this.exitWithSuccess();
      }

      throw error;
    }

    const appPrefix = this.getAppPrefix(appName);

    if (existingApps.includes(appName)) {
      const cfnStackName = this.getCfnStackName(appName);
      if (await cfnStackExists(cfnStackName, profile)) {
        this.exitWithError('A deployed app with that name already exists');
      } else {
        this.log(`Configuration for ${app} already exists`);
      }

      if (yes || (await confirm('Overwrite?'))) {
        if (!(await confirmProductionOp(this.context))) {
          this.exitWithSuccess();
        }

        await DeployConfig.wipeExisting(appPrefix, true, profile);
      } else {
        this.exitWithSuccess();
      }
    }

    /**
     * Allow importing some or all of a deploy config.
     * What gets imported will be passed to the `generate`
     * operation to complete any missing settings
     */
    let importedConfig: Partial<DeployConfigData> = {};
    if (importFlag !== undefined) {
      importedConfig = DeployConfig.fromFile(importFlag);
    }

    let deployConfig;
    try {
      deployConfig = await DeployConfig.generate(this.context, importedConfig);
    } catch (error) {
      if (error instanceof UserCancel) {
        this.exitWithSuccess();
      } else if (error instanceof NoPromptChoices) {
        this.exitWithError(
          [
            'Something went wrong trying to generate your config: ',
            error.message,
          ].join('\n'),
        );
      }

      throw error;
    }

    await DeployConfig.syncToSsm({
      appPrefix,
      deployConfig,
      profile,
    });
    this.exitWithSuccess(
      [
        chalk.yellowBright(figlet.textSync(`${appName}!`)),
        '',
        'Your new app deployment configuration is created!',
        'Next steps:',
        `  * modify or add settings with 'caccl-deploy update -a ${appName} [...]'`,
        `  * deploy the app stack with 'caccl-deploy stack -a ${appName} deploy'`,
        '',
      ].join('\n'),
    );
  }
}
