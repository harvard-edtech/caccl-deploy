/* eslint-disable camelcase */

// Import AWS CDK lib
import {
  Duration,
  SecretValue,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_docdb as docdb,
  aws_ec2 as ec2,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
// Import AWS CDK constructs
import { Construct } from 'constructs';

import { CacclDbProps } from '../../../types/index.js';
// Import constants
import DEFAULT_DB_INSTANCE_TYPE from '../constants/DEFAULT_DB_INSTANCE_TYPE.js';
import DEFAULT_DOCDB_ENGINE_VERSION from '../constants/DEFAULT_DOCDB_ENGINE_VERSION.js';
import DEFAULT_DOCDB_PARAM_GROUP_FAMILY from '../constants/DEFAULT_DOCDB_PARAM_GROUP_FAMILY.js';
import CacclDbBase from './CacclDbBase.js';
// Import types

// Import classes

class CacclDocDb extends CacclDbBase {
  metricNamespace = 'AWS/DocDB';

  constructor(scope: Construct, id: string, props: CacclDbProps) {
    super(scope, id, props);

    const { appEnv, options, vpc } = props;
    const {
      engineVersion = DEFAULT_DOCDB_ENGINE_VERSION,
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE,
      parameterGroupFamily = DEFAULT_DOCDB_PARAM_GROUP_FAMILY,
      profiler = false,
    } = options;

    if (profiler) {
      this.clusterParameterGroupParams.profiler = 'enabled';
      this.clusterParameterGroupParams.profiler_threshold_ms = '500';
    }

    const parameterGroup = new docdb.ClusterParameterGroup(
      this,
      'ClusterParameterGroup',
      {
        dbClusterParameterGroupName: `${Stack.of(this).stackName}-param-group`,
        description: `Cluster parameter group for ${Stack.of(this).stackName}`,
        family: parameterGroupFamily,
        parameters: this.clusterParameterGroupParams,
      },
    );

    this.dbCluster = new docdb.DatabaseCluster(this, 'DocDbCluster', {
      backup: {
        retention: Duration.days(14),
      },
      engineVersion,
      instanceType: new ec2.InstanceType(instanceType),
      instances: instanceCount,
      masterUser: {
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
        username: 'root',
      },
      parameterGroup,
      removalPolicy: this.removalPolicy,
      securityGroup: this.dbSg,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // this needs to happen after the parameter group has been associated with the cluster
    parameterGroup.applyRemovalPolicy(this.etcRemovalPolicy);

    this.host = this.dbCluster.clusterEndpoint.hostname;
    this.port = this.dbCluster.clusterEndpoint.portAsString();

    appEnv.addEnvironmentVar('MONGO_USER', 'root');
    appEnv.addEnvironmentVar('MONGO_HOST', `${this.host}:${this.port}`);
    appEnv.addEnvironmentVar(
      'MONGO_OPTIONS',
      'tls=true&tlsAllowInvalidCertificates=true',
    );
    appEnv.addSecret(
      'MONGO_PASS',
      ecs.Secret.fromSecretsManager(this.dbPasswordSecret),
    );

    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc.vpcCidrBlock);
  }

  createMetricsAndAlarms(): void {
    this.metrics = {
      BufferCacheHitRatio: [
        this.makeDocDbMetric('BufferCacheHitRatio', {
          unit: cloudwatch.Unit.PERCENT,
        }),
      ],
      CPUUtilization: [
        this.makeDocDbMetric('CPUUtilization', {
          unit: cloudwatch.Unit.PERCENT,
        }),
      ],
      DatabaseConnections: [this.makeDocDbMetric('DatabaseConnections')],
      DatabaseCursorsTimedOut: [
        this.makeDocDbMetric('DatabaseCursorsTimedOut', { statistic: 'sum' }),
      ],
      DiskQueueDepth: [this.makeDocDbMetric('DiskQueueDepth')],
      FreeableMemory: [this.makeDocDbMetric('FreeableMemory')],
      Queries: [this.makeDocDbMetric('OpcountersQuery')],
      ReadIOPS: [this.makeDocDbMetric('ReadIOPS')],
      ReadLatency: [
        this.makeDocDbMetric('ReadLatency', {
          unit: cloudwatch.Unit.MILLISECONDS,
        }),
      ],
      Transactions: [this.makeDocDbMetric('TransactionsOpen')],
      WriteIOPS: [this.makeDocDbMetric('WriteIOPS')],
      WriteLatency: [
        this.makeDocDbMetric('WriteLatency', {
          unit: cloudwatch.Unit.MILLISECONDS,
        }),
      ],
    };

    this.alarms = [
      new cloudwatch.Alarm(this, 'CPUUtilizationAlarm', {
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb cpu utilization alarm`,
        evaluationPeriods: 3,
        metric: this.metrics.CPUUtilization[0].with({
          period: Duration.minutes(5),
        }),
        threshold: 50,
      }),
      new cloudwatch.Alarm(this, 'BufferCacheHitRatioAlarm', {
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb buffer cache hit ratio alarm`,
        comparisonOperator:
          cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        evaluationPeriods: 3,
        metric: this.metrics.BufferCacheHitRatio[0],
        threshold: 90,
      }),
      new cloudwatch.Alarm(this, 'DiskQueueDepth', {
        alarmDescription: `${Stack.of(this).stackName} docdb disk queue depth`,
        evaluationPeriods: 3,
        metric: this.metrics.DiskQueueDepth[0],
        threshold: 1,
      }),
      new cloudwatch.Alarm(this, 'ReadLatency', {
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb read latency alarm`,
        evaluationPeriods: 3,
        metric: this.metrics.ReadLatency[0],
        threshold: 20,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
      }),
      new cloudwatch.Alarm(this, 'WriteLatency', {
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb write latency alarm`,
        evaluationPeriods: 3,
        metric: this.metrics.WriteLatency[0],
        threshold: 100,
        treatMissingData: cloudwatch.TreatMissingData.IGNORE,
      }),
      new cloudwatch.Alarm(this, 'DatabaseCursorsTimedOutAlarm', {
        alarmDescription: `${
          Stack.of(this).stackName
        } docdb cursors timed out alarm`,
        evaluationPeriods: 3,
        metric: this.metrics.DatabaseCursorsTimedOut[0].with({
          period: Duration.minutes(5),
        }),
        threshold: 5,
      }),
    ];
  }

  getDashboardLink() {
    const { region } = Stack.of(this);
    const dbClusterId = this.dbCluster.clusterIdentifier;
    return `https://console.aws.amazon.com/docdb/home?region=${region}#cluster-details/${dbClusterId}`;
  }

  makeDocDbMetric(metricName: string, extraProps = {}): cloudwatch.Metric {
    const metric = new cloudwatch.Metric({
      dimensionsMap: { DBClusterIdentifier: this.dbCluster.clusterIdentifier },
      metricName,
      namespace: this.metricNamespace,
      ...extraProps,
    }).with({ period: Duration.minutes(1) });

    return metric.attachTo(this.dbCluster);
  }
}

export default CacclDocDb;
