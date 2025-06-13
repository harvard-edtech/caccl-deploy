/* eslint-disable no-unused-vars */
import {
  RemovalPolicy,
  aws_cloudwatch as cloudwatch,
  aws_docdb as docdb,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';

/**
 * Interface for a generic DB, allowing SG config, monitoring, and more.
 * @author Benedikt Arnarsson
 */
interface ICacclDb {
  addSecurityGroupIngress(vpcCidrBlock: string): void;

  // collection of cloudwatch metric alarms
  alarms: cloudwatch.Alarm[];

  // e.g. enabling performance monitoring
  clusterParameterGroupParams: Record<string, string>;

  // overrides that get set in the cluster-level parameter group,
  createMetricsAndAlarms(): void;

  // overrides for the instance-level param group
  // the actual cluster construct
  dbCluster: docdb.DatabaseCluster | rds.DatabaseCluster;

  // will get the generated master password for the db
  dbPasswordSecret: secretsmanager.Secret;

  // the database security group
  dbSg: ec2.SecurityGroup;

  // the "etcetera" policy for the parameter group(s) and security group
  etcRemovalPolicy: RemovalPolicy;

  getDashboardLink(): string;

  // the hostname of the cluster's endpoint
  host: string;

  // e.g. turning on slow query logging
  instanceParameterGroupParams: Record<string, string>;

  // cloudwatch metrics namespace
  metricNamespace: string;

  // collection of metric constructs
  metrics: { [key: string]: cloudwatch.Metric[] };
  // cluster endpoint port
  port: string;
  // basic removal policy for the cluster/instances
  removalPolicy: RemovalPolicy;
}

export default ICacclDb;
