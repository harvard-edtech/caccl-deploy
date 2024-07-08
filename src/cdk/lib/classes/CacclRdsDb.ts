// Import AWS CDK lib
import {
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_rds as rds,
  Stack,
  SecretValue,
  Duration,
} from 'aws-cdk-lib';

// Import AWS constructs
import { Construct } from 'constructs';

// Import shared types
import CacclDbBase from './CacclDbBase.js';
import { CacclDbProps } from '../../../types/index.js';

// Import constants
import DEFAULT_AURORA_MYSQL_ENGINE_VERSION from '../constants/DEFAULT_AURORA_MYSQL_ENGINE_VERSION.js';
import DEFAULT_DB_INSTANCE_TYPE from '../constants/DEFAULT_DB_INSTANCE_TYPE.js';

// Import classes

class CacclRdsDb extends CacclDbBase {
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

export default CacclRdsDb;
