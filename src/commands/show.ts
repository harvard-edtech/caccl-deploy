// Import oclif
import { Flags } from '@oclif/core';

// Import base command
import { BaseCommand } from '../base.js';
// Import deploy config
import DeployConfig from '../deployConfig/index.js';

// eslint-disable-next-line no-use-before-define
export default class Show extends BaseCommand<typeof Show> {
  static override description = "display an app's current configuration";

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      description: 'name of the app to work with',
      required: true,
    }),
    'flat': Flags.boolean({
      char: 'f',
      default: false,
      description: 'display the flattened, key: value form of the config',
    }),
    'keep-secret-arns': Flags.boolean({
      default: false,
      description:
        'show app environment secret value ARNs instead of dereferencing',
    }),
    'sha': Flags.boolean({
      char: 's',
      default: false,
      description: 'output a sha1 hash of the current configuration',
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const { flat, 'keep-secret-arns': keepSecretArns, sha } = this.flags;

    // get assumed role
    const assumedRole = this.getAssumedRole();

    // we only want to see that sha1 hash (likely for debugging)
    if (sha) {
      const deployConfig = await this.getDeployConfig(assumedRole);
      this.exitWithSuccess(DeployConfig.toHash(deployConfig));
    }

    const deployConfig = await this.getDeployConfig(
      assumedRole,
      keepSecretArns,
    );
    this.exitWithSuccess(DeployConfig.toString(deployConfig, true, flat));
  }
}
