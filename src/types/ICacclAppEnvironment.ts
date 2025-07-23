/* eslint-disable no-unused-vars */
import { aws_ecs as ecs } from 'aws-cdk-lib';

/**
 * Interface for a generic application configuration, allowing secrets and environment variables.
 * @author Benedikt Arnarsson
 */
export interface ICacclAppEnvironment {
  addEnvironmentVar(k: string, v: string): void;
  addSecret(k: string, secret: ecs.Secret): void;

  env: Record<string, string>;
  secrets: Record<string, ecs.Secret>;
}
