// Import oclif
import { Flags } from '@oclif/core'

// Import base command
import { BaseCommand } from '../base.js'

// Import deploy config
import DeployConfig from '../deployConfig/index.js';


export default class Show extends BaseCommand<typeof Show> {
  static override description = "display an app's current configuration";

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static override flags = {
    'app': Flags.string({
      char: 'a',
      required: true,
      description: 'name of the app to work with',
    }),
    'flat': Flags.boolean({
      char: 'f',
      description: 'display the flattened, key: value form of the config',
      default: false,
    }),
    'sha': Flags.boolean({
      char: 's',
      description: 'output a sha1 hash of the current configuration',
      default: false,
    }),
    'keep-secret-arns': Flags.boolean({
      description: 'show app environment secret value ARNs instead of dereferencing',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    // Destructure flags
    const {
      flat,
      sha,
      'keep-secret-arns': keepSecretArns,
    } = this.flags;

    // get assumed role
    const assumedRole = this.getAssumedRole();
  
    // we only want to see that sha1 hash (likely for debugging)
    if (sha) {
      const deployConfig = await this.getDeployConfig(assumedRole);
      this.exitWithSuccess(DeployConfig.toHash(deployConfig));
    }
  
    const deployConfig = await this.getDeployConfig(assumedRole, keepSecretArns);
    this.exitWithSuccess(
      DeployConfig.toString(deployConfig, true, flat),
    );
  }
}
