import { Alarm, Metric, Unit, ComparisonOperator, TreatMissingData } from '@aws-cdk/aws-cloudwatch';
import { DatabaseCluster, ClusterParameterGroup } from '@aws-cdk/aws-docdb';
import { Vpc, SecurityGroup, BastionHostLinux, SubnetType, Peer, Port, InstanceType } from '@aws-cdk/aws-ec2';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Construct, Stack, CfnOutput, SecretValue, Duration } from '@aws-cdk/core';

export interface CacclDocDbProps {
  instanceType: string;
  instanceCount: number;
  profiler: boolean;
  vpc: Vpc;
}

export class CacclDocDb extends Construct {
  host: string;

  dbPasswordSecret: Secret;

  dbCluster: DatabaseCluster;

  metrics: { [key: string]: Metric };

  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclDocDbProps) {
    super(scope, id);

    const { vpc } = props;
    const bastionSg = new SecurityGroup(this, 'BastionSecurityGroup', { vpc });
    bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    const bastionHost = new BastionHostLinux(this, 'SshBastionHost', {
      vpc,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
      instanceName: `${Stack.of(this).stackName}-bastion`,
      securityGroup: bastionSg,
    });

    this.dbPasswordSecret = new Secret(this, 'DbPasswordSecret', {
      description: `docdb master user password for ${Stack.of(this).stackName}`,
      generateSecretString: {
        passwordLength: 16,
        excludePunctuation: true,
      },
    });

    const parameterGroupParams: { [key: string]: string } = {};

    if (props.profiler) {
      parameterGroupParams.profiler = 'enabled';
      parameterGroupParams.profiler_threshold_ms = '500';
    }

    const parameterGroup = new ClusterParameterGroup(this, 'ClusterParameterGroup', {
      dbClusterParameterGroupName: `${Stack.of(this).stackName}-param-group`,
      family: 'docdb3.6',
      description: `Cluster parameter group for ${Stack.of(this).stackName}`,
      parameters: parameterGroupParams,
    });

    this.dbCluster = new DatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
        password: SecretValue.secretsManager(this.dbPasswordSecret.secretArn),
      },
      parameterGroup,
      instances: props.instanceCount,
      instanceProps: {
        vpc,
        instanceType: new InstanceType(props.instanceType),
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      },
      backup: {
        retention: Duration.days(14),
      },
      engineVersion: '3.6.0',
    });
    this.host = `${this.dbCluster.clusterEndpoint.hostname}:${this.dbCluster.clusterEndpoint.portAsString()}`;

    // add an ingress rule to the db security group
    const dbSg = SecurityGroup.fromSecurityGroupId(this, 'DocDbSecurityGroup', this.dbCluster.securityGroupId);
    dbSg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(27017));

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

    new CfnOutput(this, 'DocDbClusterEndpoint', {
      exportName: `${Stack.of(this).stackName}-docdb-cluster-endpoint`,
      value: this.host,
    });

    new CfnOutput(this, 'DocDbSecretArn', {
      exportName: `${Stack.of(this).stackName}-docdb-password-secret-arn`,
      value: this.dbPasswordSecret.secretArn,
    });

    new CfnOutput(this, 'DocDbBastionHostIp', {
      exportName: `${Stack.of(this).stackName}-docdb-bastion-host-ip`,
      value: bastionHost.instancePublicIp,
    });

    new CfnOutput(this, 'DocDbBastionHostId', {
      exportName: `${Stack.of(this).stackName}-docdb-bastion-host-id`,
      value: bastionHost.instanceId,
    });

    new CfnOutput(this, 'DocDbBastionHostAZ', {
      exportName: `${Stack.of(this).stackName}-docdb-bastion-host-az`,
      value: bastionHost.instanceAvailabilityZone,
    });
  }

  makeClusterMetric(metricName: string, extraProps = {}): Metric {
    const metric = new Metric({
      metricName,
      namespace: 'AWS/DocDB',
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
