import { Secret as EcsSecret } from '@aws-cdk/aws-ecs';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Construct } from '@aws-cdk/core';

export interface CacclAppEnvioronmentProps {
  envVars: { [key: string]: string };
}

export class CacclAppEnvironment extends Construct {
  env: { [key: string]: string };

  secrets: { [key: string]: EcsSecret };

  constructor(scope: Construct, id: string, props: CacclAppEnvioronmentProps) {
    super(scope, id);

    this.env = {
      PORT: '8080',
      NODE_ENV: 'production',
    };

    this.secrets = {};
    Object.entries(props.envVars).forEach(([name, value]) => {
      if (value.toLowerCase().startsWith('arn:aws:secretsmanager')) {
        const varSecret = Secret.fromSecretArn(this, `${name}SecretArn`, value) as Secret;
        this.secrets[name] = EcsSecret.fromSecretsManager(varSecret);
      } else {
        this.env[name] = value;
      }
    });
  }

  public addEnvironmentVar(k: string, v: string): void {
    this.env[k] = v;
  }

  public addSecret(k: string, secret: EcsSecret): void {
    this.secrets[k] = secret;
  }
}
