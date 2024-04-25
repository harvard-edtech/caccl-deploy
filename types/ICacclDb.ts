/* eslint-disable no-unused-vars */
import {
  aws_cloudwatch as cloudwatch,
  aws_docdb as docdb,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  RemovalPolicy,
} from 'aws-cdk-lib';

interface ICacclDb {
  // the hostname of the cluster's endpoint
  host: string;

  // cluster endpoint port
  port: string;

  // will get the generated master password for the db
  dbPasswordSecret: secretsmanager.Secret;

  // overrides that get set in the cluster-level parameter group,
  // e.g. enabling performance monitoring
  clusterParameterGroupParams: Record<string, string>;

  // overrides for the instance-level param group
  // e.g. turning on slow query logging
  instanceParameterGroupParams: Record<string, string>;

  // the actual cluster construct
  dbCluster: docdb.DatabaseCluster | rds.DatabaseCluster;

  // cloudwatch metrics namespace
  metricNamespace: string;

  // collection of metric constructs
  metrics: { [key: string]: cloudwatch.Metric[] };

  // collection of cloudwatch metric alarms
  alarms: cloudwatch.Alarm[];

  // basic removal policy for the cluster/instances
  removalPolicy: RemovalPolicy;

  // the database security group
  dbSg: ec2.SecurityGroup;

  // the "etcetera" policy for the parameter group(s) and security group
  etcRemovalPolicy: RemovalPolicy;

  addSecurityGroupIngress(vpcCidrBlock: string): void;
  createMetricsAndAlarms(): void;
  getDashboardLink(): string;
}

export default ICacclDb;
