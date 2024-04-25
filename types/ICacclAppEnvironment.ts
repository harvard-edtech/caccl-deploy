/* eslint-disable no-unused-vars */
// Import CDK lib
import { aws_ecs as ecs } from 'aws-cdk-lib';

interface ICacclAppEnvironment {
  env: Record<string, string>;
  secrets: Record<string, ecs.Secret>;

  addEnvironmentVar(k: string, v: string): void;
  addSecret(k: string, secret: ecs.Secret): void;
}

export default ICacclAppEnvironment;
