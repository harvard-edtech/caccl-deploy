import {
  aws_cloudwatch as cloudwatch,
  aws_docdb as docdb,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  Stack,
  CfnOutput,
  SecretValue,
  Duration,
  RemovalPolicy,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { CacclAppEnvironment } from './appEnvironment';

const DEFAULT_DB_INSTANCE_TYPE = 't3.medium';
const DEFAULT_AURORA_MYSQL_ENGINE_VERSION = '5.7.mysql_aurora.2.11.2'; // current LTS
const DEFAULT_DOCDB_ENGINE_VERSION = '3.6';
const DEFAULT_DOCDB_PARAM_GROUP_FAMILY = 'docdb3.6';
const DEFAULT_REMOVAL_POLICY = 'DESTROY';

export interface CacclDbOptions {
  // currently either 'docdb' or 'mysql'
  engine: string;
  // see the aws docs for supported types
  instanceType?: string;
  // > 1 will get you multi-az
  instanceCount?: number;
  // use a non-default engine version (shouldn't be necessary)
  engineVersion?: string;
  // use a non-default parameter group family (also unnecessary)
  parameterGroupFamily?: string;
  // only used by docdb; turns on extra profiling
  profiler?: boolean;
  // only used by mysql; provisioning will create the named database
  databaseName?: string;
  // removal policy controls what happens to the db if it's replaced or otherwise stops being managed by CloudFormation
  removalPolicy?: string;
}

export interface CacclDbProps {
  // the vpc the db will be put into
  vpc: ec2.Vpc;
  options: CacclDbOptions;
  // so that we can add this construct's environment variables
  appEnv: CacclAppEnvironment;
}

interface ICacclDb {
  createMetricsAndAlarms(): void;
  getDashboardLink(): string;
}

export abstract class CacclDbBase extends Construct implements ICacclDb {
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

export class CacclDocDb extends CacclDbBase {
  metricNamespace = 'AWS/DocDB';

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id, props);

    const { vpc, appEnv } = props;
    const {
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE,
      engineVersion = DEFAULT_DOCDB_ENGINE_VERSION,
      parameterGroupFamily = DEFAULT_DOCDB_PARAM_GROUP_FAMILY,
      profiler = false,
    } = props.options;

    if (profiler) {
      this.clusterParameterGroupParams.profiler = 'enabled';
      this.clusterParameterGroupParams.profiler_threshold_ms = '500';
    }

    const parameterGroup = new docdb.ClusterParameterGroup(
      this,
      'ClusterParameterGroup',
      {
        dbClusterParameterGroupName: `${Stack.of(this).stackName}-param-group`,
        family: parameterGroupFamily,
        description: `Cluster parameter group for ${Stack.of(this).stackName}`,
        parameters: this.clusterParameterGroupParams,
      },
    );

    this.dbCluster = new docdb.DatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
      },
      parameterGroup,
      engineVersion,
      instances: instanceCount,
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroup: this.dbSg,
      backup: {
        retention: Duration.days(14),
      },
      removalPolicy: this.removalPolicy,
    });

    // this needs to happen after the parameter group has been associated with the cluster
    parameterGroup.applyRemovalPolicy(this.etcRemovalPolicy);

    this.host = this.dbCluster.clusterEndpoint.hostname;
    this.port = this.dbCluster.clusterEndpoint.portAsString();

    appEnv.addEnvironmentVar('MONGO_USER', 'root');
    appEnv.addEnvironmentVar('MONGO_HOST', `${this.host}:${this.port}`);
    appEnv.addEnvironmentVar(
      'MONGO_OPTIONS',
      'tls=true&tlsAllowInvalidCertificates=true&retryWrites=False',
    );
    appEnv.addSecret(
      'MONGO_PASS',
      ecs.Secret.fromSecretsManager(this.dbPasswordSecret),
    );

    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc.vpcCidrBlock);
  }

  makeDocDbMetric(metricName: string, extraProps = {}): cloudwatch.Metric {
    const metric = new cloudwatch.Metric({
      metricName,
      namespace: this.metricNamespace,
      dimensionsMap: { DBClusterIdentifier: this.dbCluster.clusterIdentifier },
      ...extraProps,
    }).with({ period: Duration.minutes(1) });

    return metric.attachTo(this.dbCluster);
  }

  createMetricsAndAlarms(): void {
    this.metrics = {
      ReadIOPS: [this.makeDocDbMetric('ReadIOPS')],
      WriteIOPS: [this.makeDocDbMetric('WriteIOPS')],
      CPUUtilization: [
        this.makeDocDbMetric('CPUUtilization', {
          unit: cloudwatch.Unit.PERCENT,
        }),
      ],
      FreeableMemory: [this.makeDocDbMetric('FreeableMemory')],
      BufferCacheHitRatio: [
        this.makeDocDbMetric('BufferCacheHitRatio', {
          unit: cloudwatch.Unit.PERCENT,
        }),
      ],
      DatabaseConnections: [this.makeDocDbMetric('DatabaseConnections')],
      DiskQueueDepth: [this.makeDocDbMetric('DiskQueueDepth')],
      ReadLatency: [
        this.makeDocDbMetric('ReadLatency', {
          unit: cloudwatch.Unit.MILLISECONDS,
        }),
      ],
      WriteLatency: [
        this.makeDocDbMetric('WriteLatency', {
          unit: cloudwatch.Unit.MILLISECONDS,
        }),
      ],
      DatabaseCursorsTimedOut: [
        this.makeDocDbMetric('DatabaseCursorsTimedOut', { statistic: 'sum' }),
      ],
      Transactions: [this.makeDocDbMetric('TransactionsOpen')],
      Queries: [this.makeDocDbMetric('OpcountersQuery')],
    };

    this.alarms = [
      new cloudwatch.Alarm(this, 'CPUUtilizationAlarm', {
        metric: this.metrics.CPUUtilization[0].with({
          period: Duration.minutes(5),
        }),
        threshold: 50,
        evaluationPeriods: 3,
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb cpu utilization alarm`,
      }),
      new cloudwatch.Alarm(this, 'BufferCacheHitRatioAlarm', {
        metric: this.metrics.BufferCacheHitRatio[0],
        threshold: 90,
        evaluationPeriods: 3,
        comparisonOperator:
          cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb buffer cache hit ratio alarm`,
      }),
      new cloudwatch.Alarm(this, 'DiskQueueDepth', {
        metric: this.metrics.DiskQueueDepth[0],
        threshold: 1,
        evaluationPeriods: 3,
        alarmDescription: `${Stack.of(this).stackName} docdb disk queue depth`,
      }),
      new cloudwatch.Alarm(this, 'ReadLatency', {
        metric: this.metrics.ReadLatency[0],
        threshold: 20,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb read latency alarm`,
      }),
      new cloudwatch.Alarm(this, 'WriteLatency', {
        metric: this.metrics.WriteLatency[0],
        threshold: 100,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb write latency alarm`,
      }),
      new cloudwatch.Alarm(this, 'DatabaseCursorsTimedOutAlarm', {
        metric: this.metrics.DatabaseCursorsTimedOut[0].with({
          period: Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 3,
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb cursors timed out alarm`,
      }),
    ];
  }

  getDashboardLink() {
    const { region } = Stack.of(this);
    const dbClusterId = this.dbCluster.clusterIdentifier;
    return `https://console.aws.amazon.com/docdb/home?region=${region}#cluster-details/${dbClusterId}`;
  }
}

export class CacclRdsDb extends CacclDbBase {
  metricNamespace = 'AWS/RDS';

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id, props);

    const { vpc, appEnv } = props;
    const {
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE,
      engineVersion = DEFAULT_AURORA_MYSQL_ENGINE_VERSION,
      databaseName,
    } = props.options;

    /**
     * strangely the major version is not automatically derived from whatever
     * version string is used here. This just pulls it off the engineVersion string
     * e.g. '8.0.mysql_aurora.3.02.0' -> '8.0'
     */
    const majorVersion = engineVersion.substring(0, 3);
    const auroraMysqlEngineVersion = rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.of(engineVersion, majorVersion),
    });

    // performance insights for rds mysql not supported on t3 instances
    const enablePerformanceInsights = !instanceType.startsWith('t3');

    this.clusterParameterGroupParams.lower_case_table_names = '1';

    // bin log filtering is baked in to aurora/mysql v8
    if (parseInt(majorVersion, 10) < 8) {
      this.clusterParameterGroupParams.aurora_enable_repl_bin_log_filtering =
        '1';
    }

    const clusterParameterGroup = new rds.ParameterGroup(
      this,
      'ClusterParameterGroup',
      {
        engine: auroraMysqlEngineVersion,
        description: `RDS parameter group for ${Stack.of(this).stackName}`,
        parameters: this.clusterParameterGroupParams,
      },
    );

    this.instanceParameterGroupParams.slow_query_log = '1';
    this.instanceParameterGroupParams.log_output = 'TABLE';
    this.instanceParameterGroupParams.long_query_time = '3';
    this.instanceParameterGroupParams.sql_mode = 'STRICT_ALL_TABLES';
    this.instanceParameterGroupParams.innodb_monitor_enable = 'all';

    const instanceParameterGroup = new rds.ParameterGroup(
      this,
      'InstanceParameterGroup',
      {
        engine: auroraMysqlEngineVersion,
        description: `RDS instance parameter group for ${
          Stack.of(this).stackName
        }`,
        parameters: this.instanceParameterGroupParams,
      },
    );

    this.dbCluster = new rds.DatabaseCluster(this, 'RdsDbCluster', {
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
        instanceType: new ec2.InstanceType(instanceType),
        enablePerformanceInsights,
        parameterGroup: instanceParameterGroup,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [this.dbSg],
      },
      backup: {
        retention: Duration.days(14),
      },
      removalPolicy: this.removalPolicy,
    });

    // this needs to happen after the parameter group has been associated with the cluster
    clusterParameterGroup.applyRemovalPolicy(this.etcRemovalPolicy);
    instanceParameterGroup.applyRemovalPolicy(this.etcRemovalPolicy);

    // for rds/mysql we do NOT include the port as part of the host value
    this.host = this.dbCluster.clusterEndpoint.hostname;
    this.port = '3306';

    appEnv.addEnvironmentVar('DATABASE_USER', 'root');
    appEnv.addEnvironmentVar('DATABASE_PORT', this.port);
    appEnv.addEnvironmentVar('DATABASE_HOST', this.host);
    appEnv.addEnvironmentVar('DATABASE_NAME', databaseName ?? '');
    appEnv.addSecret(
      'DATABASE_PASSWORD',
      ecs.Secret.fromSecretsManager(this.dbPasswordSecret),
    );

    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc.vpcCidrBlock);
  }

  makeInstanceMetrics(
    metricName: string,
    extraProps = {},
  ): cloudwatch.Metric[] {
    return this.dbCluster.instanceIdentifiers.map((id) => {
      const metric = new cloudwatch.Metric({
        metricName,
        namespace: this.metricNamespace,
        dimensionsMap: { DBInstanceIdentifier: id },
        label: id,
        ...extraProps,
      }).with({ period: Duration.minutes(1) });

      return metric.attachTo(this.dbCluster);
    });
  }

  createMetricsAndAlarms(): void {
    this.metrics = {
      ReadIOPS: this.makeInstanceMetrics('ReadIOPS'),
      WriteIOPS: this.makeInstanceMetrics('WriteIOPS'),
      CPUUtilization: this.makeInstanceMetrics('CPUUtilization', {
        unit: cloudwatch.Unit.PERCENT,
      }),
      FreeableMemory: this.makeInstanceMetrics('FreeableMemory'),
      BufferCacheHitRatio: this.makeInstanceMetrics('BufferCacheHitRatio', {
        unit: cloudwatch.Unit.PERCENT,
      }),
      DatabaseConnections: this.makeInstanceMetrics('DatabaseConnections'),
      DiskQueueDepth: this.makeInstanceMetrics('DiskQueueDepth'),
      ReadLatency: this.makeInstanceMetrics('ReadLatency', {
        unit: cloudwatch.Unit.MILLISECONDS,
      }),
      WriteLatency: this.makeInstanceMetrics('WriteLatency', {
        unit: cloudwatch.Unit.MILLISECONDS,
      }),
      DatabaseCursorsTimedOut: this.makeInstanceMetrics(
        'DatabaseCursorsTimedOut',
        { statistic: 'sum' },
      ),
      Transactions: this.makeInstanceMetrics('ActiveTransactions'),
      Queries: this.makeInstanceMetrics('Queries'),
    };

    this.alarms = [
      ...this.metrics.ReadIOPS.map((metric: cloudwatch.Metric, idx: number) => {
        return new cloudwatch.Alarm(this, `CPUUtilizationAlarm-${idx}`, {
          metric,
          threshold: 50,
          evaluationPeriods: 3,
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } cpu utilization alarm`,
        });
      }),
      ...this.metrics.BufferCacheHitRatio.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `BufferCacheHitRatioAlarm-${idx}`, {
          metric,
          threshold: 90,
          evaluationPeriods: 3,
          comparisonOperator:
            cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } buffer cache hit ratio alarm`,
        });
      }),
      ...this.metrics.DiskQueueDepth.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `DiskQueueDepth-${idx}`, {
          metric,
          threshold: 1,
          evaluationPeriods: 3,
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } disk queue depth`,
        });
      }),
      ...this.metrics.ReadLatency.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `ReadLatency-${idx}`, {
          metric,
          threshold: 20,
          evaluationPeriods: 3,
          treatMissingData: cloudwatch.TreatMissingData.IGNORE,
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } read latency alarm`,
        });
      }),
      ...this.metrics.WriteLatency.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `WriteLatency-${idx}`, {
          metric,
          threshold: 100,
          evaluationPeriods: 3,
          treatMissingData: cloudwatch.TreatMissingData.IGNORE,
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } write latency alarm`,
        });
      }),
      ...this.metrics.DatabaseCursorsTimedOut.map((metric, idx) => {
        return new cloudwatch.Alarm(
          this,
          `DatabaseCursorsTimedOutAlarm-${idx}`,
          {
            metric,
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: `${Stack.of(this).stackName} ${
              metric.label
            } cursors timed out alarm`,
          },
        );
      }),
    ];
  }

  getDashboardLink() {
    const { region } = Stack.of(this);
    const dbClusterId = this.dbCluster.clusterIdentifier;
    return `https://console.aws.amazon.com/rds/home?region=${region}#database:id=${dbClusterId};is-cluster=true`;
  }
}

/**
 * factory method for creating either a DocDb or RdsDb construct
 *
 * @param scope the standard app scope arg
 * @param props props for creating the cluster construct
 * @returns either a CacclDocDb or CacclRdsDb
 */
export function createDbConstruct(scope: Construct, props: CacclDbProps) {
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
