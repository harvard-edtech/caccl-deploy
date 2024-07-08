import {
  aws_cloudwatch as cloudwatch,
  aws_docdb as docdb,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  Stack,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';

// Import shared types
import { CacclDbProps, ICacclDb } from '../../../types/index.js';

// Import constants
import DEFAULT_REMOVAL_POLICY from '../constants/DEFAULT_REMOVAL_POLICY.js';

abstract class CacclDbBase extends Construct implements ICacclDb {
  // the hostname of the cluster's endpoint
  host: string;

  // cluster endpoint port
  port: string;

  // will get the generated master password for the db
  dbPasswordSecret: secretsmanager.Secret;

  // overrides that get set in the cluster-level parameter group,
  // e.g. enabling performance monitoring
  clusterParameterGroupParams: { [key: string]: string } = {};

  // overrides for the instance-level param group
  // e.g. turning on slow query logging
  instanceParameterGroupParams: { [key: string]: string } = {};

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

  // TODO: JSDoc for constructor
  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id);

    const { vpc } = props;
    const { removalPolicy = DEFAULT_REMOVAL_POLICY } = props.options;

    // removal policy for the cluster & instances
    this.removalPolicy = (<any>RemovalPolicy)[removalPolicy];
    // if we're keeping the dbs we have to keep the parameter group
    // and security group or cloudformation will barf. Also there's no
    // "SNAPSHOT" option for these resources so it's either "RETAIN" or "DESTROY"
    this.etcRemovalPolicy =
      this.removalPolicy === RemovalPolicy.RETAIN
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY;

    this.dbPasswordSecret = new secretsmanager.Secret(
      this,
      'DbPasswordSecret',
      {
        description: `docdb master user password for ${
          Stack.of(this).stackName
        }`,
        generateSecretString: {
          passwordLength: 16,
          excludePunctuation: true,
        },
      },
    );

    this.dbPasswordSecret.applyRemovalPolicy(this.etcRemovalPolicy);

    /**
     * the database needs it's own security group so that we can apply
     * a removal policy to it. if we re-used the main stack's security group
     * then we wouldn't be able to treat it separately from the rest of the
     * stack resources
     */
    this.dbSg = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'security group for the db cluster',
      allowAllOutbound: false,
    });

    this.dbSg.applyRemovalPolicy(this.etcRemovalPolicy);

    /**
     * why do we `allowAllOutbound: false` just above and then undo it here?
     * because CDK complains if we don't. something about allowAllOutbound
     * not allowing IPv6 traffic so they had to add a warning?
     */
    this.dbSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());
  }

  // FIXME: doesn't do anything?
  createOutputs() {
    new CfnOutput(this, 'DbClusterEndpoint', {
      exportName: `${Stack.of(this).stackName}-db-cluster-endpoint`,
      value: `${this.host}:${this.port}`,
    });

    new CfnOutput(this, 'DbSecretArn', {
      exportName: `${Stack.of(this).stackName}-db-password-secret-arn`,
      value: this.dbPasswordSecret.secretArn,
    });
  }

  addSecurityGroupIngress(vpcCidrBlock: string) {
    this.dbCluster.connections.allowDefaultPortInternally();
    this.dbCluster.connections.allowDefaultPortFrom(
      ec2.Peer.ipv4(vpcCidrBlock),
    );
  }

  abstract createMetricsAndAlarms(): void;

  abstract getDashboardLink(): string;
}

export default CacclDbBase;
