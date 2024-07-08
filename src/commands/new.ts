// Import chalk
import chalk from 'chalk';

// Import figlet
import figlet from 'figlet';

// Import oclif
import { Flags } from '@oclif/core'

// Import aws
import {
  cfnStackExists,
  getAppList,
} from '../aws/index.js';

// Import base command
import { BaseCommand } from '../base.js';

// Import config prompts
import {
  confirm,
  confirmProductionOp,
  promptAppName,
} from '../configPrompts/index.js';

// Import deploy config
import DeployConfig from '../deployConfig/index.js';

// Import errors
import NoPromptChoices from '../shared/errors/NoPromptChoices.js';
import UserCancel from '../shared/errors/UserCancel.js';

// Import helpers
import exitWithError from '../helpers/exitWithError.js';
import exitWithSuccess from '../helpers/exitWithSuccess.js';

export default class New extends BaseCommand<typeof New> {
  static override description = 'create a new app deploy config via import and/or prompts';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
    }),
    'import': Flags.string({
      char: 'i',
      description: 'import new deploy config from a json file or URL',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      'ssm-root-prefix': ssmRootPrefix,
      app,
      'import': importFlag,
      yes,
    } = this.flags;

    const assumedRole = this.getAssumedRole();
    if (this.ecrAccessRoleArn !== undefined) {
      assumedRole.setAssumedRoleArn(this.ecrAccessRoleArn);
    }
    const existingApps = await getAppList(ssmRootPrefix);

    let appName;
    try {
      appName = app || (await promptAppName());
    } catch (err) {
      if (err instanceof UserCancel) {
        exitWithSuccess();
      }
      throw err;
    }

    const appPrefix = this.getAppPrefix(appName);

    if (existingApps.includes(appName)) {
      const cfnStackName = this.getCfnStackName(appName);
      if (await cfnStackExists(cfnStackName)) {
        exitWithError('A deployed app with that name already exists');
      } else {
        console.log(`Configuration for ${app} already exists`);
      }

      if (yes || (await confirm('Overwrite?'))) {
        if (!(await confirmProductionOp(yes))) {
          exitWithSuccess();
        }
        await DeployConfig.wipeExisting(appPrefix);
      } else {
        exitWithSuccess();
      }
    }

    /**
     * Allow importing some or all of a deploy config.
     * What gets imported will be passed to the `generate`
     * operation to complete any missing settings
     */
    let importedConfig;
    if (importFlag !== undefined) {
      importedConfig = /^http(s):\//.test(importFlag)
        ? await DeployConfig.fromUrl(importFlag)
        : DeployConfig.fromFile(importFlag);
    }

    let deployConfig;
    try {
      deployConfig = await DeployConfig.generate(assumedRole, importedConfig);
    } catch (err) {
      if (err instanceof UserCancel) {
        exitWithSuccess();
      } else if (err instanceof NoPromptChoices) {
        exitWithError(
          [
            'Something went wrong trying to generate your config: ',
            err.message,
          ].join('\n'),
        );
      }
      throw err;
    }

    await DeployConfig.syncToSsm(deployConfig, appPrefix);
    exitWithSuccess(
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
