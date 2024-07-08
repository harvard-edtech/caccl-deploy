// Import AWS CDK lib
import {
  aws_cloudwatch as cloudwatch,
  aws_docdb as docdb,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  Stack,
  SecretValue,
  Duration,
} from 'aws-cdk-lib';

// Import AWS CDK constructs
import { Construct } from 'constructs';

// Import types
import CacclDbBase from './CacclDbBase.js';
import { CacclDbProps } from '../../../types/index.js';

// Import constants
import DEFAULT_DB_INSTANCE_TYPE from '../constants/DEFAULT_DB_INSTANCE_TYPE.js';
import DEFAULT_DOCDB_ENGINE_VERSION from '../constants/DEFAULT_DOCDB_ENGINE_VERSION.js';
import DEFAULT_DOCDB_PARAM_GROUP_FAMILY from '../constants/DEFAULT_DOCDB_PARAM_GROUP_FAMILY.js';

// Import classes

class CacclDocDb extends CacclDbBase {
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

export default CacclDocDb;
