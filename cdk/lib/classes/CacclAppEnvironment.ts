// Import CDK lib
import {
  aws_ecs as ecs,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';

// Import AWS constructs
import { Construct } from 'constructs';

// Import shared types
import { CacclAppEnvironmentProps, ICacclAppEnvironment } from '../../../types';

class CacclAppEnvironment extends Construct implements ICacclAppEnvironment {
  env: { [key: string]: string };

  secrets: { [key: string]: ecs.Secret };

  constructor(scope: Construct, id: string, props: CacclAppEnvironmentProps) {
    super(scope, id);

    this.env = {
      PORT: '8080',
      NODE_ENV: 'production',
    };

    this.secrets = {};
    Object.entries(props.envVars).forEach(([name, value]) => {
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
    });
  }

  public addEnvironmentVar(k: string, v: string): void {
    this.env[k] = v;
  }

  public addSecret(k: string, secret: ecs.Secret): void {
    this.secrets[k] = secret;
  }
}

export default CacclAppEnvironment;
