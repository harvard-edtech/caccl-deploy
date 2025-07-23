/* eslint-disable camelcase */
// Import AWS CDK lib
import {
  Duration,
  SecretValue,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_rds as rds,
} from 'aws-cdk-lib';
// Import AWS constructs
import { Construct } from 'constructs';

import { type CacclDbProps } from '../../../types/index.js';
// Import constants
import DEFAULT_AURORA_MYSQL_ENGINE_VERSION from '../constants/DEFAULT_AURORA_MYSQL_ENGINE_VERSION.js';
import DEFAULT_DB_INSTANCE_TYPE from '../constants/DEFAULT_DB_INSTANCE_TYPE.js';
import CacclDbBase from './CacclDbBase.js';
// Import shared types

// Import classes

class CacclRdsDb extends CacclDbBase {
  override metricNamespace = 'AWS/RDS';

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id, props);

    const { appEnv, options, vpc } = props;
    const {
      databaseName,
      engineVersion = DEFAULT_AURORA_MYSQL_ENGINE_VERSION,
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE,
    } = options;

    /**
     * strangely the major version is not automatically derived from whatever
     * version string is used here. This just pulls it off the engineVersion string
     * e.g. '8.0.mysql_aurora.3.02.0' -> '8.0'
     */
    const majorVersion = engineVersion.slice(0, 3);
    const auroraMysqlEngineVersion = rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.of(engineVersion, majorVersion),
    });

    // performance insights for rds mysql not supported on t3 instances
    const enablePerformanceInsights = !instanceType.startsWith('t3');

    this.clusterParameterGroupParams.lower_case_table_names = '1';

    // bin log filtering is baked in to aurora/mysql v8
    if (Number.parseInt(majorVersion, 10) < 8) {
      this.clusterParameterGroupParams.aurora_enable_repl_bin_log_filtering =
        '1';
    }

    const clusterParameterGroup = new rds.ParameterGroup(
      this,
      'ClusterParameterGroup',
      {
        description: `RDS parameter group for ${Stack.of(this).stackName}`,
        engine: auroraMysqlEngineVersion,
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
        description: `RDS instance parameter group for ${
          Stack.of(this).stackName
        }`,
        engine: auroraMysqlEngineVersion,
        parameters: this.instanceParameterGroupParams,
      },
    );

    this.dbCluster = new rds.DatabaseCluster(this, 'RdsDbCluster', {
      backup: {
        retention: Duration.days(14),
      },
      clusterIdentifier: `${Stack.of(this).stackName}-db-cluster`,
      credentials: {
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
        username: 'root',
      },
      defaultDatabaseName: databaseName,
      engine: auroraMysqlEngineVersion,
      instanceProps: {
        enablePerformanceInsights,
        instanceType: new ec2.InstanceType(instanceType),
        parameterGroup: instanceParameterGroup,
        securityGroups: [this.dbSg],
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
      instances: instanceCount,
      parameterGroup: clusterParameterGroup,
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

  createMetricsAndAlarms(): void {
    this.metrics = {
      BufferCacheHitRatio: this.makeInstanceMetrics('BufferCacheHitRatio', {
        unit: cloudwatch.Unit.PERCENT,
      }),
      CPUUtilization: this.makeInstanceMetrics('CPUUtilization', {
        unit: cloudwatch.Unit.PERCENT,
      }),
      DatabaseConnections: this.makeInstanceMetrics('DatabaseConnections'),
      DatabaseCursorsTimedOut: this.makeInstanceMetrics(
        'DatabaseCursorsTimedOut',
        { statistic: 'sum' },
      ),
      DiskQueueDepth: this.makeInstanceMetrics('DiskQueueDepth'),
      FreeableMemory: this.makeInstanceMetrics('FreeableMemory'),
      Queries: this.makeInstanceMetrics('Queries'),
      ReadIOPS: this.makeInstanceMetrics('ReadIOPS'),
      ReadLatency: this.makeInstanceMetrics('ReadLatency', {
        unit: cloudwatch.Unit.MILLISECONDS,
      }),
      Transactions: this.makeInstanceMetrics('ActiveTransactions'),
      WriteIOPS: this.makeInstanceMetrics('WriteIOPS'),
      WriteLatency: this.makeInstanceMetrics('WriteLatency', {
        unit: cloudwatch.Unit.MILLISECONDS,
      }),
    };

    this.alarms = [
      ...this.metrics.ReadIOPS!.map(
        (metric: cloudwatch.Metric, idx: number) => {
          return new cloudwatch.Alarm(this, `CPUUtilizationAlarm-${idx}`, {
            alarmDescription: `${Stack.of(this).stackName} ${
              metric.label
            } cpu utilization alarm`,
            evaluationPeriods: 3,
            metric,
            threshold: 50,
          });
        },
      ),
      ...this.metrics.BufferCacheHitRatio!.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `BufferCacheHitRatioAlarm-${idx}`, {
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } buffer cache hit ratio alarm`,
          comparisonOperator:
            cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 3,
          metric,
          threshold: 90,
        });
      }),
      ...this.metrics.DiskQueueDepth!.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `DiskQueueDepth-${idx}`, {
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } disk queue depth`,
          evaluationPeriods: 3,
          metric,
          threshold: 1,
        });
      }),
      ...this.metrics.ReadLatency!.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `ReadLatency-${idx}`, {
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } read latency alarm`,
          evaluationPeriods: 3,
          metric,
          threshold: 20,
          treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        });
      }),
      ...this.metrics.WriteLatency!.map((metric, idx) => {
        return new cloudwatch.Alarm(this, `WriteLatency-${idx}`, {
          alarmDescription: `${Stack.of(this).stackName} ${
            metric.label
          } write latency alarm`,
          evaluationPeriods: 3,
          metric,
          threshold: 100,
          treatMissingData: cloudwatch.TreatMissingData.IGNORE,
        });
      }),
      ...this.metrics.DatabaseCursorsTimedOut!.map((metric, idx) => {
        return new cloudwatch.Alarm(
          this,
          `DatabaseCursorsTimedOutAlarm-${idx}`,
          {
            alarmDescription: `${Stack.of(this).stackName} ${
              metric.label
            } cursors timed out alarm`,
            evaluationPeriods: 1,
            metric,
            threshold: 1,
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

  makeInstanceMetrics(
    metricName: string,
    extraProps = {},
  ): cloudwatch.Metric[] {
    return this.dbCluster.instanceIdentifiers.map((id) => {
      const metric = new cloudwatch.Metric({
        dimensionsMap: { DBInstanceIdentifier: id },
        label: id,
        metricName,
        namespace: this.metricNamespace,
        ...extraProps,
      }).with({ period: Duration.minutes(1) });

      return metric.attachTo(this.dbCluster);
    });
  }
}

export default CacclRdsDb;
