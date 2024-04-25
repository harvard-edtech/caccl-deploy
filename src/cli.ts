// Import NodeJS libs
// import { execSync } from 'child_process';

// Import chalk
import chalk from 'chalk';

// Import figlet
import figlet from 'figlet';

// Import package.json

// Import aws
import { isConfigured } from './aws';

// Import commands
import addAppsCommand from './commands/addAppsCommand';
import addNewCommand from './commands/addNewCommand';
import addScheduleCommand from './commands/addScheduleCommand';

// Import constants
import CacclDeployCommander from './commands/classes/CacclDeployCommander';
import CACCL_DEPLOY_NON_INTERACTIVE from './commands/constants/CACCL_DEPLOY_NON_INTERACTIVE';

// Import helpers
import byeWithCredentialsError from './commands/helpers/byeWithCredentialsError';
import exitWithSuccess from './commands/helpers/exitWithSuccess';

// Import config
import { conf, configDefaults, setConfigDefaults } from './conf';

// Import prompts
import { confirm } from './configPrompts';
import generateVersion from './shared/helpers/generateVersion';
import packageJson from '../package.json';

/**
 * Main entrypoint for the caccl-deploy CLI.
 * @author Jay Luker
 */
const main = async () => {
  // confirm ASAP that the user's AWS creds/config is good to go
  if (!isConfigured() && process.env.NODE_ENV !== 'test') {
    byeWithCredentialsError();
  }

  const cacclDeployVersion = generateVersion();
  const { description: packageDescription } = packageJson;

  /*
   * check if this is the first time running and if so create the
   * config file with defaults
   */
  if (!conf.get('ssmRootPrefix')) {
    console.log(chalk.greenBright(figlet.textSync('Caccl-Deploy!')));
    console.log(
      [
        'It looks like this is your first time running caccl-deploy. ',
        `A preferences file has been created at ${chalk.yellow(conf.path)}`,
        'with the following default values:',
        '',
        ...Object.entries(configDefaults).map(([k, v]) => {
          return `  - ${chalk.yellow(k)}: ${chalk.bold(JSON.stringify(v))}`;
        }),
        '',
        'Please see the docs for explanations of these settings',
      ].join('\n'),
    );

    CACCL_DEPLOY_NON_INTERACTIVE ||
      (await confirm('Continue?', true)) ||
      exitWithSuccess();
    setConfigDefaults();
  }

  const cli = new CacclDeployCommander()
    .version(cacclDeployVersion)
    .description([packageDescription, `config: ${conf.path}`].join('\n'));

  addAppsCommand(cli);
  addNewCommand(cli);
  addScheduleCommand(cli);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
