import { Alarm, Metric, Unit, ComparisonOperator, TreatMissingData } from '@aws-cdk/aws-cloudwatch';
import { Vpc, SecurityGroup, SubnetType, Peer, Port, InstanceType } from '@aws-cdk/aws-ec2';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Secret as EcsSecret } from '@aws-cdk/aws-ecs';
import { Construct, Stack, CfnOutput, SecretValue, Duration } from '@aws-cdk/core';
import {
  DatabaseCluster as DocDbDatabaseCluster,
  ClusterParameterGroup as DocDbClusterParameterGroup,
} from '@aws-cdk/aws-docdb';
import {
  DatabaseCluster as RdsDatabaseCluster,
  ParameterGroup as RdsParameterGroup,
  DatabaseClusterEngine as RdsDatabaseClusterEngine,
  AuroraMysqlEngineVersion
} from '@aws-cdk/aws-rds';
import { CacclAppEnvironment } from './appEnvironment';

const DEFAULT_DB_INSTANCE_TYPE = 't3.medium';
const DEFAULT_AURORA_MYSQL_ENGINE_VERSION = '5.7.mysql_aurora.2.04.9'; // current LTS
const DEFAULT_DOCDB_ENGINE_VERSION = 'docdb3.6';

export interface CacclDbOptions {
  // currently either 'docdb' or 'mysql'
  engine: string,
  // see the aws docs for supported types
  instanceType?: string,
  // > 1 will get you multi-az
  instanceCount?: number,
  // use a non-default engine version (shouldn't be necessary)
  engineVersion?: string,
  // only used by docdb; turns on extra profiling
  profiler?: boolean,
  // only used by mysql; provisioning will create the named database
  databaseName?: string,
}

export interface CacclDbProps {
  // the vpc the db will be put into
  vpc: Vpc,
  options: CacclDbOptions,
  // so that we can add this construct's environment variables
  appEnv: CacclAppEnvironment,
}

export class CacclDb extends Construct {
  host: string;

  port: string;

  dbPasswordSecret: Secret;

  clusterParameterGroupParams: { [key: string]: string } = {};

  instanceParameterGroupParams: { [key: string]: string } = {};

  dbCluster: DocDbDatabaseCluster | RdsDatabaseCluster;

  metricNamespace: string;

  metrics: { [key: string]: Metric };

  alarms: Alarm[];

  getDashboardLink: Function;

  static createDbConstruct(scope: Construct, props: CacclDbProps) {
    const { options } = props;
    switch (options.engine.toLowerCase()) {
      case 'docdb':
        return new CacclDocDb(scope, 'DocDb', props);
      case 'mysql':
        return new CacclRdsDb(scope, 'RdsDb', props);
      default:
        throw Error(`Invalid dbOptions.engine value: ${options.engine}`);
    }
  }

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id);

    this.dbPasswordSecret = new Secret(this, 'DbPasswordSecret', {
      description: `docdb master user password for ${Stack.of(this).stackName}`,
      generateSecretString: {
        passwordLength: 16,
        excludePunctuation: true,
      },
    });
  }

  createMetricsAndAlarms() {
    this.metrics = {
      ReadIOPS: this.makeClusterMetric('ReadIOPS'),
      WriteIOPS: this.makeClusterMetric('WriteIOPS'),
      CPUUtilization: this.makeClusterMetric('CPUUtilization', { unit: Unit.PERCENT }),
      FreeableMemory: this.makeClusterMetric('FreeableMemory'),
      BufferCacheHitRatio: this.makeClusterMetric('BufferCacheHitRatio', { unit: Unit.PERCENT }),
      DatabaseConnections: this.makeClusterMetric('DatabaseConnections'),
      DiskQueueDepth: this.makeClusterMetric('DiskQueueDepth'),
      ReadLatency: this.makeClusterMetric('ReadLatency', { unit: Unit.MILLISECONDS }),
      WriteLatency: this.makeClusterMetric('WriteLatency', { unit: Unit.MILLISECONDS }),
      DatabaseCursorsTimedOut: this.makeClusterMetric('DatabaseCursorsTimedOut', { statistic: 'sum' }),
    };

    this.alarms = [
      new Alarm(this, 'CPUUtilizationAlarm', {
        metric: this.metrics.CPUUtilization,
        threshold: 50,
        period: Duration.minutes(5),
        evaluationPeriods: 3,
        alarmDescription: `${Stack.of(this).stackName} docdb cpu utilization alarm`,
      }),
      new Alarm(this, 'BufferCacheHitRatioAlarm', {
        metric: this.metrics.BufferCacheHitRatio,
        threshold: 90,
        evaluationPeriods: 3,
        comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: `${Stack.of(this).stackName} docdb buffer cache hit ratio alarm`,
      }),
      new Alarm(this, 'DiskQueueDepth', {
        metric: this.metrics.DiskQueueDepth,
        threshold: 1,
        evaluationPeriods: 3,
        alarmDescription: `${Stack.of(this).stackName} docdb disk queue depth`,
      }),
      new Alarm(this, 'ReadLatency', {
        metric: this.metrics.ReadLatency,
        threshold: 20,
        evaluationPeriods: 3,
        treatMissingData: TreatMissingData.IGNORE,
        alarmDescription: `${Stack.of(this).stackName} docdb read latency alarm`,
      }),
      new Alarm(this, 'WriteLatency', {
        metric: this.metrics.WriteLatency,
        threshold: 100,
        evaluationPeriods: 3,
        treatMissingData: TreatMissingData.IGNORE,
        alarmDescription: `${Stack.of(this).stackName} docdb write latency alarm`,
      }),
      new Alarm(this, 'DatabaseCursorsTimedOutAlarm', {
        metric: this.metrics.DatabaseCursorsTimedOut,
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${Stack.of(this).stackName} docdb cursors timed out alarm`,
      }),
    ];
  }

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

  addSecurityGroupIngress(vpc: Vpc) {
    this.dbCluster.connections.allowDefaultPortInternally();
    this.dbCluster.connections.allowDefaultPortFrom(Peer.ipv4(vpc.vpcCidrBlock));

  }

  makeClusterMetric(metricName: string, extraProps = {}): Metric {
    const metric = new Metric({
      metricName,
      namespace: this.metricNamespace,
      period: Duration.minutes(1),
      dimensions: {
        DBClusterIdentifier: this.dbCluster.clusterIdentifier,
      },
      ...extraProps,
    });
    metric.attachTo(this.dbCluster);
    return metric;
  }
}

export class CacclDocDb extends CacclDb {

  metricNamespace = 'AWS/DocDB';

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id, props);

    const { vpc, appEnv } = props;
    const {
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE,
      engineVersion = DEFAULT_DOCDB_ENGINE_VERSION,
      profiler = false,
    } = props.options;

    if (profiler) {
      this.clusterParameterGroupParams.profiler = 'enabled';
      this.clusterParameterGroupParams.profiler_threshold_ms = '500';
    }

    const parameterGroup = new DocDbClusterParameterGroup(this, 'ClusterParameterGroup', {
      dbClusterParameterGroupName: `${Stack.of(this).stackName}-param-group`,
      family: engineVersion,
      description: `Cluster parameter group for ${Stack.of(this).stackName}`,
      parameters: this.clusterParameterGroupParams,
    });

    this.dbCluster = new DocDbDatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
      },
      parameterGroup,
      instances: instanceCount,
      instanceProps: {
        vpc,
        instanceType: new InstanceType(instanceType),
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      },
      backup: {
        retention: Duration.days(14),
      },
    });

    this.host = this.dbCluster.clusterEndpoint.hostname;
    this.port = this.dbCluster.clusterEndpoint.portAsString();

    // add an ingress rule to the db security group
    // const dbSg = SecurityGroup.fromSecurityGroupId(this, 'DocDbSecurityGroup', this.dbCluster.securityGroupId);
    // const ingressPort = Port.tcp(+this.port)
    // dbSg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), ingressPort);

    appEnv.addEnvironmentVar('MONGO_USER', 'root');
    appEnv.addEnvironmentVar('MONGO_HOST', `${this.host}:${this.port}`);
    appEnv.addEnvironmentVar('MONGO_OPTIONS', 'tls=true&tlsAllowInvalidCertificates=true');
    appEnv.addSecret('MONGO_PASS', EcsSecret.fromSecretsManager(this.dbPasswordSecret));

    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc);

    this.getDashboardLink = () => {
      const { region } = Stack.of(this);
      const dbClusterId = this.dbCluster.clusterIdentifier;
      return `https://console.aws.amazon.com/docdb/home?region=${region}#cluster-details/${dbClusterId}`;
    }
  }
}

export class CacclRdsDb extends CacclDb {

  metricNamespace = 'AWS/RDS';

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id, props);

    const { vpc, appEnv } = props;
    const {
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE,
      engineVersion = DEFAULT_AURORA_MYSQL_ENGINE_VERSION,
      profiler = false,
      databaseName,
    } = props.options;

    const auroraMysqlEngineVersion = RdsDatabaseClusterEngine
      .auroraMysql({
        version: AuroraMysqlEngineVersion.of(engineVersion),
      });

    this.clusterParameterGroupParams.lower_case_table_names = "1";
    this.clusterParameterGroupParams.aurora_enable_repl_bin_log_filtering = "1";

    const clusterParameterGroup = new RdsParameterGroup(this, 'ClusterParameterGroup', {
      engine: auroraMysqlEngineVersion,
      description: `RDS parameter group for ${Stack.of(this).stackName}`,
      parameters: this.clusterParameterGroupParams,
    });

    this.instanceParameterGroupParams.slow_query_log = "1";
    this.instanceParameterGroupParams.log_output = "TABLE";
    this.instanceParameterGroupParams.long_query_time = "3";
    this.instanceParameterGroupParams.sql_mode = 'STRICT_ALL_TABLES';

    const instanceParameterGroup = new RdsParameterGroup(this, 'InstanceParameterGroup', {
      engine: auroraMysqlEngineVersion,
      description: `RDS instance parameter group for ${Stack.of(this).stackName}`,
      parameters: this.instanceParameterGroupParams,
    });

    this.dbCluster = new RdsDatabaseCluster(this, 'RdsDbCluster', {
      engine: auroraMysqlEngineVersion,
      clusterIdentifier: `${Stack.of(this).stackName}-db-cluster`,
      credentials: {
        username: 'root',
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
      },
      parameterGroup: clusterParameterGroup,
      instances: instanceCount,
      defaultDatabaseName: databaseName,
      instanceProps: {
        vpc,
        instanceType: new InstanceType(instanceType),
        parameterGroup: instanceParameterGroup,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      },
      backup: {
        retention: Duration.days(14),
      }
    });

    // for rds/mysql we do NOT include the port as part of the host value
    this.host = this.dbCluster.clusterEndpoint.hostname;
    this.port = '3306';

    // add an ingress rule to the db security group
    this.dbCluster.connections.allowDefaultPortInternally();
    this.dbCluster.connections.allowDefaultPortFrom(Peer.ipv4(vpc.vpcCidrBlock));

    appEnv.addEnvironmentVar('DATABASE_USER', 'root');
    appEnv.addEnvironmentVar('DATABASE_PORT', this.port);
    appEnv.addEnvironmentVar('DATABASE_HOST', this.host);
    appEnv.addEnvironmentVar('DATABASE_NAME', databaseName || '');
    appEnv.addSecret('DATABASE_PASSWORD', EcsSecret.fromSecretsManager(this.dbPasswordSecret));

    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc);

    this.getDashboardLink = () => {
      const { region } = Stack.of(this);
      const dbClusterId = this.dbCluster.clusterIdentifier;
      return `https://console.aws.amazon.com/rds/home?region=${region}#database:id=${dbClusterId};is-cluster=true`;
    }
  }
}
