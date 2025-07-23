// Import CDK lib
import {
  aws_ecs as ecs,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
// Import AWS constructs
import { Construct } from 'constructs';

// Import shared types
import {
  type CacclAppEnvironmentProps,
  type ICacclAppEnvironment,
} from '../../../types/index.js';

class CacclAppEnvironment extends Construct implements ICacclAppEnvironment {
  env: { [key: string]: string };

  secrets: { [key: string]: ecs.Secret };

  constructor(scope: Construct, id: string, props: CacclAppEnvironmentProps) {
    super(scope, id);

    this.env = {
      NODE_ENV: 'production',
      PORT: '8080',
    };

    this.secrets = {};
    for (const [name, value] of Object.entries(props.envVars)) {
      if (value.toString().toLowerCase().startsWith('arn:aws:secretsmanager')) {
        const varSecret = secretsmanager.Secret.fromSecretCompleteArn(
          this,
          `${name}SecretArn`,
          value,
        );
        this.secrets[name] = ecs.Secret.fromSecretsManager(varSecret);
      } else {
        this.env[name] = value;
      }
    }
  }

  public addEnvironmentVar(k: string, v: string): void {
    this.env[k] = v;
  }

  public addSecret(k: string, secret: ecs.Secret): void {
    this.secrets[k] = secret;
  }
}

export default CacclAppEnvironment;
