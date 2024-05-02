'use strict';
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value,
      })
    : (obj[key] = value);
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod,
  )
);

// cdk/cdk.ts
var import_register = require('source-map-support/register');
var import_fs2 = require('fs');
var import_aws_cdk_lib16 = require('aws-cdk-lib');
var import_yn = __toESM(require('yn'));

// cdk/lib/classes/CacclDeployStack.ts
var import_aws_cdk_lib15 = require('aws-cdk-lib');

// cdk/lib/classes/CacclAppEnvironment.ts
var import_aws_cdk_lib = require('aws-cdk-lib');
var import_constructs = require('constructs');
var CacclAppEnvironment = class extends import_constructs.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    this.env = {
      PORT: '8080',
      NODE_ENV: 'production',
    };
    this.secrets = {};
    Object.entries(props.envVars).forEach(([name, value]) => {
      if (value.toString().toLowerCase().startsWith('arn:aws:secretsmanager')) {
        const varSecret =
          import_aws_cdk_lib.aws_secretsmanager.Secret.fromSecretCompleteArn(
            this,
            `${name}SecretArn`,
            value,
          );
        this.secrets[name] =
          import_aws_cdk_lib.aws_ecs.Secret.fromSecretsManager(varSecret);
      } else {
        this.env[name] = value;
      }
    });
  }
  addEnvironmentVar(k, v) {
    this.env[k] = v;
  }
  addSecret(k, secret) {
    this.secrets[k] = secret;
  }
};
var CacclAppEnvironment_default = CacclAppEnvironment;

// cdk/lib/classes/CacclCache.ts
var import_aws_cdk_lib2 = require('aws-cdk-lib');
var import_constructs2 = require('constructs');
var CacclCache = class extends import_constructs2.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const { vpc, appEnv } = props;
    const {
      engine = 'redis',
      numCacheNodes = 1,
      cacheNodeType = 'cache.t3.medium',
    } = props.options;
    const subnetGroup = new import_aws_cdk_lib2.aws_elasticache.CfnSubnetGroup(
      this,
      'CacheSubnetGroup',
      {
        description: `List of subnets for ${
          import_aws_cdk_lib2.Stack.of(this).stackName
        }`,
        subnetIds: vpc.privateSubnets.map((subnet) => {
          return subnet.subnetId;
        }),
      },
    );
    this.cacheSg = new import_aws_cdk_lib2.aws_ec2.SecurityGroup(
      this,
      'CacheSecurityGroup',
      {
        vpc,
        description: 'security group for the elasticache cluster',
        allowAllOutbound: false,
      },
    );
    this.cacheSg.addIngressRule(
      import_aws_cdk_lib2.aws_ec2.Peer.ipv4(vpc.vpcCidrBlock),
      import_aws_cdk_lib2.aws_ec2.Port.tcp(6379),
      'allow from internal network',
    );
    this.cacheSg.addEgressRule(
      import_aws_cdk_lib2.aws_ec2.Peer.anyIpv4(),
      import_aws_cdk_lib2.aws_ec2.Port.allTcp(),
    );
    this.cache = new import_aws_cdk_lib2.aws_elasticache.CfnCacheCluster(
      this,
      'CacheCluster',
      {
        engine,
        numCacheNodes,
        cacheNodeType,
        cacheSubnetGroupName: subnetGroup.ref,
        vpcSecurityGroupIds: [this.cacheSg.securityGroupId],
      },
    );
    appEnv.addEnvironmentVar('REDIS_HOST', this.cache.attrRedisEndpointAddress);
    appEnv.addEnvironmentVar('REDIS_PORT', this.cache.attrRedisEndpointPort);
    new import_aws_cdk_lib2.CfnOutput(this, 'CacheClusterEndpoint', {
      exportName: `${
        import_aws_cdk_lib2.Stack.of(this).stackName
      }-cache-endpoint`,
      value: `${this.cache.attrRedisEndpointAddress}:6379`,
    });
  }
};
var CacclCache_default = CacclCache;

// cdk/lib/classes/CacclLoadBalancer.ts
var import_aws_cdk_lib3 = require('aws-cdk-lib');
var import_constructs3 = require('constructs');
var CacclLoadBalancer = class extends import_constructs3.Construct {
  constructor(scope, id, props) {
    var _a2, _b2;
    super(scope, id);
    const {
      vpc,
      securityGroups,
      certificateArn,
      loadBalancerTarget,
      albLogBucketName: albLogBucketName2,
      // includes targetDeregistrationDelay & healthCheckPath which are applied to the ApplicationTargetGroup below
      extraOptions,
    } = props;
    const targetDeregistrationDelay =
      (_a2 =
        extraOptions == null
          ? void 0
          : extraOptions.targetDeregistrationDelay) != null
        ? _a2
        : 30;
    const healthCheckPath =
      (_b2 = extraOptions == null ? void 0 : extraOptions.healthCheckPath) !=
      null
        ? _b2
        : '/';
    this.loadBalancer =
      new import_aws_cdk_lib3.aws_elasticloadbalancingv2.ApplicationLoadBalancer(
        this,
        'LoadBalancer',
        {
          vpc,
          securityGroup: securityGroups.primary,
          internetFacing: true,
        },
      );
    if (securityGroups.misc) {
      this.loadBalancer.addSecurityGroup(securityGroups.misc);
    }
    if (albLogBucketName2 !== void 0) {
      const bucket = import_aws_cdk_lib3.aws_s3.Bucket.fromBucketName(
        this,
        'AlbLogBucket',
        albLogBucketName2,
      );
      const objPrefix = import_aws_cdk_lib3.Stack.of(this).stackName;
      this.loadBalancer.logAccessLogs(bucket, objPrefix);
    }
    new import_aws_cdk_lib3.aws_elasticloadbalancingv2.CfnListener(
      this,
      'HttpRedirect',
      {
        loadBalancerArn: this.loadBalancer.loadBalancerArn,
        protocol:
          import_aws_cdk_lib3.aws_elasticloadbalancingv2.ApplicationProtocol
            .HTTP,
        port: 80,
        defaultActions: [
          {
            type: 'redirect',
            redirectConfig: {
              statusCode: 'HTTP_301',
              port: '443',
              protocol: 'HTTPS',
              host: '#{host}',
              path: '/#{path}',
              query: '#{query}',
            },
          },
        ],
      },
    );
    const httpsListener =
      new import_aws_cdk_lib3.aws_elasticloadbalancingv2.ApplicationListener(
        this,
        'HttpsListener',
        {
          loadBalancer: this.loadBalancer,
          certificates: certificateArn ? [{ certificateArn }] : [],
          port: 443,
          protocol:
            import_aws_cdk_lib3.aws_elasticloadbalancingv2.ApplicationProtocol
              .HTTPS,
          /**
           * if we don't make this false the listener construct will add rules
           * to our security group that we don't want/need
           */
          open: false,
        },
      );
    const atgProps = {
      vpc,
      port: 443,
      protocol:
        import_aws_cdk_lib3.aws_elasticloadbalancingv2.ApplicationProtocol
          .HTTPS,
      // setting this duration value enables the lb stickiness; 1 day is the default
      stickinessCookieDuration: import_aws_cdk_lib3.Duration.seconds(86400),
      targetType: import_aws_cdk_lib3.aws_elasticloadbalancingv2.TargetType.IP,
      targets: [loadBalancerTarget],
      deregistrationDelay: import_aws_cdk_lib3.Duration.seconds(
        targetDeregistrationDelay,
      ),
      healthCheck: {
        // allow a redirect to indicate service is operational
        healthyHttpCodes: '200,302',
      },
    };
    if (healthCheckPath !== void 0 && healthCheckPath !== '/') {
      atgProps.healthCheck = __spreadValues(
        __spreadValues({}, atgProps.healthCheck),
        { path: healthCheckPath },
      );
    }
    const appTargetGroup =
      new import_aws_cdk_lib3.aws_elasticloadbalancingv2.ApplicationTargetGroup(
        this,
        'TargetGroup',
        atgProps,
      );
    httpsListener.addTargetGroups('AppTargetGroup', {
      targetGroups: [appTargetGroup],
    });
    this.metrics = {
      RequestCount: this.loadBalancer.metricRequestCount(),
      NewConnectionCount: this.loadBalancer.metricNewConnectionCount(),
      ActiveConnectionCount: this.loadBalancer.metricActiveConnectionCount(),
      TargetResponseTime: this.loadBalancer
        .metricTargetResponseTime({
          period: import_aws_cdk_lib3.Duration.minutes(1),
          unit: import_aws_cdk_lib3.aws_cloudwatch.Unit.MILLISECONDS,
          statistic: 'avg',
        })
        .with({ period: import_aws_cdk_lib3.Duration.minutes(1) }),
      RejectedConnectionCount: this.loadBalancer
        .metricRejectedConnectionCount({
          period: import_aws_cdk_lib3.Duration.minutes(1),
          statistic: 'sum',
        })
        .with({ period: import_aws_cdk_lib3.Duration.minutes(1) }),
      UnHealthyHostCount: appTargetGroup
        .metricUnhealthyHostCount({
          period: import_aws_cdk_lib3.Duration.minutes(1),
          statistic: 'sum',
        })
        .with({ period: import_aws_cdk_lib3.Duration.minutes(1) }),
    };
    this.alarms = [
      new import_aws_cdk_lib3.aws_cloudwatch.Alarm(
        this,
        'TargetResponseTimeAlarm',
        {
          metric: this.metrics.TargetResponseTime,
          threshold: 1,
          evaluationPeriods: 3,
          treatMissingData:
            import_aws_cdk_lib3.aws_cloudwatch.TreatMissingData.IGNORE,
          alarmDescription: `${
            import_aws_cdk_lib3.Stack.of(this).stackName
          } load balancer target response time (TargetResponseTime)`,
        },
      ),
      new import_aws_cdk_lib3.aws_cloudwatch.Alarm(
        this,
        'RejectedConnectionsAlarm',
        {
          metric: this.metrics.RejectedConnectionCount,
          threshold: 1,
          evaluationPeriods: 1,
          treatMissingData:
            import_aws_cdk_lib3.aws_cloudwatch.TreatMissingData.IGNORE,
          alarmDescription: `${
            import_aws_cdk_lib3.Stack.of(this).stackName
          } load balancer rejected connections (RejectedConnectionCount)`,
        },
      ),
      new import_aws_cdk_lib3.aws_cloudwatch.Alarm(this, 'UnhealthHostAlarm', {
        metric: this.metrics.UnHealthyHostCount,
        threshold: 1,
        evaluationPeriods: 3,
        treatMissingData:
          import_aws_cdk_lib3.aws_cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          import_aws_cdk_lib3.Stack.of(this).stackName
        } target group unhealthy host count (UnHealthyHostCount)`,
      }),
    ];
    new import_aws_cdk_lib3.CfnOutput(this, 'LoadBalancerHostname', {
      exportName: `${
        import_aws_cdk_lib3.Stack.of(this).stackName
      }-load-balancer-hostname`,
      value: this.loadBalancer.loadBalancerDnsName,
    });
    if (securityGroups.primary) {
      new import_aws_cdk_lib3.CfnOutput(
        this,
        'LoadBalancerPrimarySecurityGroup',
        {
          exportName: `${
            import_aws_cdk_lib3.Stack.of(this).stackName
          }-primary-security-group`,
          value: securityGroups.primary.securityGroupId,
        },
      );
    }
    if (securityGroups.misc) {
      new import_aws_cdk_lib3.CfnOutput(this, 'LoadBalancerMiscSecurityGroup', {
        exportName: `${
          import_aws_cdk_lib3.Stack.of(this).stackName
        }-misc-security-group`,
        value: securityGroups.misc.securityGroupId,
      });
    }
  }
};
var CacclLoadBalancer_default = CacclLoadBalancer;

// cdk/lib/classes/CacclMonitoring.ts
var import_aws_cdk_lib4 = require('aws-cdk-lib');
var import_constructs4 = require('constructs');
var CacclMonitoring = class extends import_constructs4.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const { stackName: stackName2 } = import_aws_cdk_lib4.Stack.of(this);
    const { cacclLoadBalancer, cacclService } = props;
    const { loadBalancer } = cacclLoadBalancer;
    const { ecsService } = cacclService;
    const dashboardName = `${stackName2}-metrics`;
    this.dashboard = new import_aws_cdk_lib4.aws_cloudwatch.Dashboard(
      this,
      'Dashboard',
      {
        dashboardName,
      },
    );
    this.region = import_aws_cdk_lib4.Stack.of(this).region;
    const dashboardLink = `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboardName}`;
    new import_aws_cdk_lib4.CfnOutput(this, 'DashboardLink', {
      value: dashboardLink,
      exportName: `${stackName2}-cloudwatch-dashboard-link`,
    });
    const lbLink = `https://console.aws.amazon.com/ec2/v2/home?region=${this.region}#LoadBalancers:tag:caccl_deploy_stack_name=${stackName2}`;
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.TextWidget({
        markdown: [
          `### Load Balancer: [${loadBalancer.loadBalancerName}](${lbLink})`,
          '[Explanation of Metrics](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)',
        ].join(' | '),
        width: 24,
        height: 1,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'RequestCount',
        left: [cacclLoadBalancer.metrics.RequestCount],
        width: 12,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'TargetResponseTime',
        left: [cacclLoadBalancer.metrics.TargetResponseTime],
        width: 12,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.AlarmStatusWidget({
        alarms: cacclLoadBalancer.alarms,
        height: 6,
        width: 8,
        title: 'Load Balancer Alarm States',
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'NewConnectionCount',
        left: [cacclLoadBalancer.metrics.NewConnectionCount],
        width: 8,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'ActiveConnectionCount',
        left: [cacclLoadBalancer.metrics.ActiveConnectionCount],
        width: 8,
        height: 6,
      }),
    );
    const httpCodeWidgets = ['2', '3', '4', '5'].map((i) => {
      const metricName = `HTTP ${i}xx Count`;
      const httpCode = `TARGET_${i}XX_COUNT`;
      return new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: metricName,
        left: [
          loadBalancer.metricHttpCodeTarget(
            import_aws_cdk_lib4.aws_elasticloadbalancingv2.HttpCodeTarget[
              httpCode
            ],
          ),
        ],
      });
    });
    this.dashboard.addWidgets(...httpCodeWidgets);
    const serviceLink = `https://console.aws.amazon.com/ecs/home?region=${this.region}#/clusters/${ecsService.cluster.clusterName}/services/${ecsService.serviceName}/details`;
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.TextWidget({
        markdown: `### ECS Service: [${ecsService.serviceName}](${serviceLink})`,
        width: 24,
        height: 1,
      }),
    );
    const makeCIMetric = (metricName, extraProps = {}) => {
      const metric = new import_aws_cdk_lib4.aws_cloudwatch.Metric(
        __spreadValues(
          {
            metricName,
            namespace: 'ECS/ContainerInsights',
            dimensionsMap: {
              ClusterName: ecsService.cluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
          },
          extraProps,
        ),
      );
      metric.attachTo(ecsService);
      return metric;
    };
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'CPUUtilization',
        left: [
          makeCIMetric('CpuUtilized', {
            unit: import_aws_cdk_lib4.aws_cloudwatch.Unit.PERCENT,
          }),
          makeCIMetric('CpuReserved', {
            unit: import_aws_cdk_lib4.aws_cloudwatch.Unit.PERCENT,
          }),
        ],
        width: 12,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'MemoryUtilization',
        left: [makeCIMetric('MemoryUtilized'), makeCIMetric('MemoryReserved')],
        width: 12,
        height: 6,
      }),
    );
    const servcieAlarmWidget = [];
    if (cacclService.alarms.length) {
      servcieAlarmWidget.push(
        new import_aws_cdk_lib4.aws_cloudwatch.AlarmStatusWidget({
          alarms: cacclService.alarms,
          width: 8,
          height: 6,
          title: 'ECS Service Alarm States',
        }),
      );
    }
    this.dashboard.addWidgets(
      ...servcieAlarmWidget,
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Storage Read/Write Bytes',
        left: [makeCIMetric('StorageReadBytes')],
        right: [makeCIMetric('StorageWriteBytes')],
        width: 12,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Tasks & Deployments',
        left: [
          makeCIMetric('DesiredTaskCount'),
          makeCIMetric('PendingTaskCount'),
          makeCIMetric('RunningTaskCount'),
        ],
        right: [ecsService.metric('DeploymentCount')],
        width: 12,
        height: 6,
      }),
    );
    const makeLogLink = (logGroup) => {
      const escapedLg = logGroup.split('/').join('$252F');
      return `* [${logGroup}](https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#logsV2:log-groups/log-group/${escapedLg})`;
    };
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.TextWidget({
        markdown: [
          '### Logs\n',
          makeLogLink(`/${stackName2}/app`),
          makeLogLink(`/${stackName2}/proxy`),
        ].join('\n'),
        width: 24,
        height: 4,
      }),
    );
  }
  addDbSection(db) {
    const { dbCluster } = db;
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.TextWidget({
        markdown: `### Database Cluster: [${
          dbCluster.clusterIdentifier
        }](${db.getDashboardLink()})`,
        width: 24,
        height: 1,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Read/Write IOPS',
        left: db.metrics.ReadIOPS,
        right: db.metrics.WriteIOPS,
        width: 12,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'CPU & Memory',
        left: db.metrics.CPUUtilization,
        right: db.metrics.FreeableMemory,
        width: 12,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Read/Write Latency',
        left: db.metrics.ReadLatency,
        right: db.metrics.WriteLatency,
        width: 12,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Transactions/Queries',
        left: db.metrics.Transactions,
        right: db.metrics.Queries,
        width: 12,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.AlarmStatusWidget({
        alarms: db.alarms,
        width: 24,
        height: 6,
        title: 'Database Alarm States',
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        left: db.metrics.BufferCacheHitRatio,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        left: db.metrics.DatabaseConnections,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        left: db.metrics.DiskQueueDepth,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        left: db.metrics.DatabaseCursorsTimedOut,
      }),
    );
  }
  addScheduledTasksSection(scheduledTasks) {
    const func = scheduledTasks.taskExecFunction;
    const functionUrl = `https://console.aws.amazon.com/lambda/home?region=${this.region}#/functions/${func.functionName}`;
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.TextWidget({
        markdown: `###  Scheduled Tasks Function: [${func.functionName}](${functionUrl})`,
        width: 24,
        height: 1,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Duration',
        left: [func.metricDuration()],
        width: 8,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Invocations',
        left: [func.metricInvocations()],
        width: 8,
        height: 6,
      }),
      new import_aws_cdk_lib4.aws_cloudwatch.GraphWidget({
        title: 'Errors',
        left: [func.metricErrors()],
        width: 8,
        height: 6,
      }),
    );
    this.dashboard.addWidgets(
      new import_aws_cdk_lib4.aws_cloudwatch.AlarmStatusWidget({
        alarms: scheduledTasks.alarms,
        width: 24,
        height: 6,
        title: 'Scheduled Tasks Function Alarm States',
      }),
    );
  }
};
var CacclMonitoring_default = CacclMonitoring;

// cdk/lib/classes/CacclNotifications.ts
var import_path = __toESM(require('path'));
var import_aws_cdk_lib5 = require('aws-cdk-lib');
var import_constructs5 = require('constructs');
var CacclNotifications = class extends import_constructs5.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const email = typeof props.email === 'string' ? [props.email] : props.email;
    const { slack, service, loadBalancer, db } = props;
    this.topic = new import_aws_cdk_lib5.aws_sns.Topic(
      this,
      'NotificationTopic',
      {
        displayName: `${
          import_aws_cdk_lib5.Stack.of(this).stackName
        }-notifications`,
      },
    );
    this.topic.grantPublish({
      grantPrincipal: new import_aws_cdk_lib5.aws_iam.ServicePrincipal(
        'cloudwatch.amazonaws.com',
      ),
    });
    if (email) {
      email.forEach((emailAddr, idx) => {
        new import_aws_cdk_lib5.aws_sns.Subscription(
          this,
          `email-subscription-${idx}`,
          {
            topic: this.topic,
            protocol: import_aws_cdk_lib5.aws_sns.SubscriptionProtocol.EMAIL,
            endpoint: emailAddr,
          },
        );
      });
    }
    if (slack !== void 0) {
      const slackFunction = new import_aws_cdk_lib5.aws_lambda.Function(
        this,
        'SlackFunction',
        {
          functionName: `${
            import_aws_cdk_lib5.Stack.of(this).stackName
          }-slack-notify`,
          runtime: import_aws_cdk_lib5.aws_lambda.Runtime.PYTHON_3_8,
          handler: 'notify.handler',
          code: import_aws_cdk_lib5.aws_lambda.Code.fromAsset(
            import_path.default.join(__dirname, 'assets/slack_notify'),
          ),
          environment: {
            SLACK_WEBHOOK_URL: slack,
          },
        },
      );
      this.topic.addSubscription(
        new import_aws_cdk_lib5.aws_sns_subscriptions.LambdaSubscription(
          slackFunction,
        ),
      );
    }
    loadBalancer.alarms.forEach((alarm) => {
      alarm.addAlarmAction(
        new import_aws_cdk_lib5.aws_cloudwatch_actions.SnsAction(this.topic),
      );
    });
    service.alarms.forEach((alarm) => {
      alarm.addAlarmAction(
        new import_aws_cdk_lib5.aws_cloudwatch_actions.SnsAction(this.topic),
      );
    });
    db == null
      ? void 0
      : db.alarms.forEach((alarm) => {
          alarm.addAlarmAction(
            new import_aws_cdk_lib5.aws_cloudwatch_actions.SnsAction(
              this.topic,
            ),
          );
        });
    new import_aws_cdk_lib5.CfnOutput(this, 'TopicName', {
      exportName: `${
        import_aws_cdk_lib5.Stack.of(this).stackName
      }-sns-topic-name`,
      value: this.topic.topicName,
    });
    new import_aws_cdk_lib5.CfnOutput(this, 'TopicArn', {
      exportName: `${
        import_aws_cdk_lib5.Stack.of(this).stackName
      }-sns-topic-arn`,
      value: this.topic.topicArn,
    });
  }
};
var CacclNotifications_default = CacclNotifications;

// cdk/lib/classes/CacclScheduledTasks.ts
var import_path2 = __toESM(require('path'));
var import_aws_cdk_lib6 = require('aws-cdk-lib');
var import_constructs6 = require('constructs');
var CacclScheduledTasks = class extends import_constructs6.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    this.eventRules = [];
    this.alarms = [];
    const {
      stackName: stackName2,
      region,
      account,
    } = import_aws_cdk_lib6.Stack.of(this);
    const { clusterName, serviceName, taskDefinition, vpc, scheduledTasks } =
      props;
    this.taskExecFunction = new import_aws_cdk_lib6.aws_lambda.Function(
      this,
      'ScheduledTaskExecFunction',
      {
        functionName: `${stackName2}-scheduled-task-exec`,
        runtime: import_aws_cdk_lib6.aws_lambda.Runtime.NODEJS_12_X,
        handler: 'index.handler',
        code: import_aws_cdk_lib6.aws_lambda.Code.fromAsset(
          import_path2.default.join(__dirname, 'assets/scheduled_task_exec'),
        ),
        vpc,
        vpcSubnets: {
          subnetType:
            import_aws_cdk_lib6.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        environment: {
          ECS_CLUSTER: clusterName,
          ECS_SERVICE: serviceName,
          ECS_TASK_DEFINITION: taskDefinition.family,
        },
      },
    );
    Object.keys(scheduledTasks).forEach((scheduledTaskId) => {
      const scheduledTask = scheduledTasks[scheduledTaskId];
      const eventTarget =
        new import_aws_cdk_lib6.aws_events_targets.LambdaFunction(
          this.taskExecFunction,
          {
            // this is the json event object that the lambda function receives
            event: import_aws_cdk_lib6.aws_events.RuleTargetInput.fromObject({
              execCommand: scheduledTask.command,
            }),
          },
        );
      const schedule = import_aws_cdk_lib6.aws_events.Schedule.expression(
        `cron(${scheduledTask.schedule})`,
      );
      const ruleName = `${import_aws_cdk_lib6.Stack.of(
        this,
      )}-scheduled-task-${scheduledTaskId}`;
      const eventRule = new import_aws_cdk_lib6.aws_events.Rule(
        this,
        `ScheduledTaskEventRule${scheduledTaskId}`,
        {
          ruleName,
          schedule,
          targets: [eventTarget],
          description: scheduledTask.description,
        },
      );
      this.eventRules.push(eventRule);
    });
    this.taskExecFunction.addToRolePolicy(
      new import_aws_cdk_lib6.aws_iam.PolicyStatement({
        effect: import_aws_cdk_lib6.aws_iam.Effect.ALLOW,
        actions: ['ecs:Describe*', 'ecs:List*'],
        resources: ['*'],
      }),
    );
    this.taskExecFunction.addToRolePolicy(
      new import_aws_cdk_lib6.aws_iam.PolicyStatement({
        effect: import_aws_cdk_lib6.aws_iam.Effect.ALLOW,
        actions: ['ecs:RunTask'],
        resources: [
          `arn:aws:ecs:${region}:${account}:task-definition/${taskDefinition.family}`,
        ],
      }),
    );
    const passRoleArns = [taskDefinition.taskRole.roleArn];
    if (taskDefinition.executionRole) {
      passRoleArns.push(taskDefinition.executionRole.roleArn);
    }
    this.taskExecFunction.addToRolePolicy(
      new import_aws_cdk_lib6.aws_iam.PolicyStatement({
        effect: import_aws_cdk_lib6.aws_iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: passRoleArns,
      }),
    );
    this.alarms = [
      // alarm on any function errors
      new import_aws_cdk_lib6.aws_cloudwatch.Alarm(this, 'ErrorAlarm', {
        metric: this.taskExecFunction
          .metricErrors()
          .with({ period: import_aws_cdk_lib6.Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${stackName2} scheduled task execution error alarm`,
      }),
      // alarm if function isn't invoked at least once per day
      new import_aws_cdk_lib6.aws_cloudwatch.Alarm(this, 'InvocationsAlarm', {
        metric: this.taskExecFunction
          .metricInvocations()
          .with({ period: import_aws_cdk_lib6.Duration.days(1) }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${stackName2} no invocations alarm`,
        comparisonOperator:
          import_aws_cdk_lib6.aws_cloudwatch.ComparisonOperator
            .LESS_THAN_THRESHOLD,
      }),
    ];
    new import_aws_cdk_lib6.CfnOutput(this, 'DeployConfigHash', {
      exportName: `${stackName2}-scheduled-tasks-function-name`,
      value: this.taskExecFunction.functionName,
    });
  }
};
var CacclScheduledTasks_default = CacclScheduledTasks;

// cdk/lib/classes/CacclService.ts
var import_aws_cdk_lib7 = require('aws-cdk-lib');
var import_constructs7 = require('constructs');
var CacclService = class extends import_constructs7.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const {
      cluster,
      taskDef,
      taskCount,
      loadBalancerSg,
      enableExecuteCommand = false,
    } = props;
    const serviceSg = new import_aws_cdk_lib7.aws_ec2.SecurityGroup(
      this,
      'SecurityGroup',
      {
        vpc: cluster.vpc,
        description: 'ecs service security group',
      },
    );
    serviceSg.connections.allowFrom(
      loadBalancerSg,
      import_aws_cdk_lib7.aws_ec2.Port.tcp(443),
    );
    this.ecsService = new import_aws_cdk_lib7.aws_ecs.FargateService(
      this,
      'FargateService',
      {
        cluster,
        securityGroups: [serviceSg],
        platformVersion:
          import_aws_cdk_lib7.aws_ecs.FargatePlatformVersion.VERSION1_4,
        taskDefinition: taskDef.taskDef,
        desiredCount: taskCount,
        minHealthyPercent: 100,
        maxHealthyPercent: 200,
        circuitBreaker: {
          rollback: true,
        },
        propagateTags: import_aws_cdk_lib7.aws_ecs.PropagatedTagSource.SERVICE,
        enableExecuteCommand,
      },
    );
    this.loadBalancerTarget = this.ecsService.loadBalancerTarget({
      containerName: taskDef.proxyContainer.containerName,
      containerPort: 443,
    });
    this.alarms = [];
    new import_aws_cdk_lib7.CfnOutput(this, 'ClusterName', {
      exportName: `${
        import_aws_cdk_lib7.Stack.of(this).stackName
      }-cluster-name`,
      value: cluster.clusterName,
    });
    new import_aws_cdk_lib7.CfnOutput(this, 'ServiceName', {
      exportName: `${
        import_aws_cdk_lib7.Stack.of(this).stackName
      }-service-name`,
      value: this.ecsService.serviceName,
    });
  }
};
var CacclService_default = CacclService;

// cdk/lib/classes/CacclSshBastion.ts
var import_aws_cdk_lib8 = require('aws-cdk-lib');
var import_constructs8 = require('constructs');

// cdk/lib/constants/DEFAULT_AMI_MAP.ts
var DEFAULT_AMI_MAP = {
  // this value should be updated on a regular basis.
  // the latest amazon linux ami is recorded in the public parameter store entry
  // /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2
  'us-east-1': 'ami-02b972fec07f1e659',
};
var DEFAULT_AMI_MAP_default = DEFAULT_AMI_MAP;

// cdk/lib/classes/CacclSshBastion.ts
var CacclSshBastion = class extends import_constructs8.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const { vpc, sg } = props;
    this.instance = new import_aws_cdk_lib8.aws_ec2.BastionHostLinux(
      this,
      'SshBastionHost',
      {
        vpc,
        subnetSelection: {
          subnetType: import_aws_cdk_lib8.aws_ec2.SubnetType.PUBLIC,
        },
        instanceName: `${import_aws_cdk_lib8.Stack.of(this).stackName}-bastion`,
        securityGroup: sg,
        machineImage: import_aws_cdk_lib8.aws_ec2.MachineImage.genericLinux(
          DEFAULT_AMI_MAP_default,
        ),
      },
    );
    new import_aws_cdk_lib8.CfnOutput(this, 'DbBastionHostIp', {
      exportName: `${
        import_aws_cdk_lib8.Stack.of(this).stackName
      }-bastion-host-ip`,
      value: this.instance.instancePublicIp,
    });
    new import_aws_cdk_lib8.CfnOutput(this, 'DbBastionHostId', {
      exportName: `${
        import_aws_cdk_lib8.Stack.of(this).stackName
      }-bastion-host-id`,
      value: this.instance.instanceId,
    });
    new import_aws_cdk_lib8.CfnOutput(this, 'DbBastionHostAZ', {
      exportName: `${
        import_aws_cdk_lib8.Stack.of(this).stackName
      }-bastion-host-az`,
      value: this.instance.instanceAvailabilityZone,
    });
    new import_aws_cdk_lib8.CfnOutput(this, 'DbBastionSecurityGroupId', {
      exportName: `${
        import_aws_cdk_lib8.Stack.of(this).stackName
      }-bastion-security-group-id`,
      value: sg.securityGroupId,
    });
  }
};
var CacclSshBastion_default = CacclSshBastion;

// cdk/lib/classes/CacclTaskDef.ts
var import_aws_cdk_lib11 = require('aws-cdk-lib');
var import_constructs11 = require('constructs');

// cdk/lib/classes/CacclContainerImage.ts
var import_fs = __toESM(require('fs'));
var import_path3 = __toESM(require('path'));
var import_aws_cdk_lib9 = require('aws-cdk-lib');
var import_constructs9 = require('constructs');
var CacclContainerImage = class extends import_constructs9.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const { appImage, buildPath = process.env.APP_DIR } = props;
    if (appImage !== void 0) {
      if (appImage.startsWith('arn:aws:ecr')) {
        let repoTag = 'latest';
        let repoArn;
        const splitArn = appImage.split(':');
        if (splitArn.length === 7) {
          repoArn = splitArn.slice(0, 6).join(':');
          repoTag = splitArn.slice(-1).join();
        } else {
          repoArn = appImage;
        }
        const repo = import_aws_cdk_lib9.aws_ecr.Repository.fromRepositoryArn(
          this,
          'ContainerImageRepo',
          repoArn,
        );
        this.image =
          import_aws_cdk_lib9.aws_ecs.ContainerImage.fromEcrRepository(
            repo,
            repoTag,
          );
      } else {
        this.image =
          import_aws_cdk_lib9.aws_ecs.ContainerImage.fromRegistry(appImage);
      }
    } else if (buildPath !== void 0) {
      if (
        !import_fs.default.existsSync(
          import_path3.default.join(buildPath, 'Dockerfile'),
        )
      ) {
        console.error(`No Dockerfile found at ${buildPath}`);
        process.exit(1);
      }
      this.image =
        import_aws_cdk_lib9.aws_ecs.ContainerImage.fromAsset(buildPath);
    } else {
      console.error('Missing configuration options for building the app image');
      console.error('At least one of the following must be defined:');
      console.error(' * deployConfig.appImage.repoName');
      console.error(' * deployConfig.appImage.buildPath');
      console.error(' * the $APP_DIR environment variable');
      process.exit(1);
    }
  }
};
var CacclContainerImage_default = CacclContainerImage;

// cdk/lib/classes/CacclGitRepoVolumeContainer.ts
var import_aws_cdk_lib10 = require('aws-cdk-lib');
var import_constructs10 = require('constructs');

// cdk/lib/constants/VOLUME_CONTAINER_MOUNT_PATH.ts
var VOLUME_CONTAINER_MOUNT_PATH = '/var/gitrepo';
var VOLUME_CONTAINER_MOUNT_PATH_default = VOLUME_CONTAINER_MOUNT_PATH;

// cdk/lib/constants/VOLUME_NAME.ts
var VOLUME_NAME = 'gitrepovolume';
var VOLUME_NAME_default = VOLUME_NAME;

// cdk/lib/classes/CacclGitRepoVolumeContainer.ts
var CacclGitRepoVolumeContainer = class extends import_constructs10.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const { taskDefinition, appContainer, repoUrlSecretArn, appContainerPath } =
      props;
    taskDefinition.addVolume({ name: VOLUME_NAME_default });
    const repoUrlSecret =
      import_aws_cdk_lib10.aws_ecs.Secret.fromSecretsManager(
        import_aws_cdk_lib10.aws_secretsmanager.Secret.fromSecretCompleteArn(
          this,
          'RepoUrlSecret',
          repoUrlSecretArn,
        ),
      );
    this.container = new import_aws_cdk_lib10.aws_ecs.ContainerDefinition(
      this,
      'GitRepoVolumeContainer',
      {
        image:
          import_aws_cdk_lib10.aws_ecs.ContainerImage.fromRegistry(
            'alpine/git',
          ),
        command: ['git clone --branch master $GIT_REPO_URL /var/gitrepo'],
        entryPoint: ['sh', '-c'],
        essential: false,
        taskDefinition,
        secrets: {
          GIT_REPO_URL: repoUrlSecret,
        },
      },
    );
    this.container.addMountPoints({
      containerPath: VOLUME_CONTAINER_MOUNT_PATH_default,
      readOnly: false,
      sourceVolume: VOLUME_NAME_default,
    });
    appContainer.addMountPoints({
      containerPath: appContainerPath,
      readOnly: false,
      sourceVolume: VOLUME_NAME_default,
    });
    appContainer.addContainerDependencies({
      container: this.container,
      condition:
        import_aws_cdk_lib10.aws_ecs.ContainerDependencyCondition.SUCCESS,
    });
  }
};
var CacclGitRepoVolumeContainer_default = CacclGitRepoVolumeContainer;

// cdk/lib/constants/DEFAULT_PROXY_REPO_NAME.ts
var DEFAULT_PROXY_REPO_NAME = 'hdce/nginx-ssl-proxy';
var DEFAULT_PROXY_REPO_NAME_default = DEFAULT_PROXY_REPO_NAME;

// cdk/lib/classes/CacclTaskDef.ts
var CacclTaskDef = class extends import_constructs11.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const {
      appImage,
      proxyImage = `${DEFAULT_PROXY_REPO_NAME_default}:latest`,
      appEnvironment,
      taskCpu = 256,
      // in cpu units; 256 == .25 vCPU
      taskMemory = 512,
      // in MiB
      logRetentionDays = 90,
    } = props;
    const appContainerImage = new CacclContainerImage_default(
      this,
      'AppImage',
      {
        appImage,
      },
    );
    this.taskDef = new import_aws_cdk_lib11.aws_ecs.FargateTaskDefinition(
      this,
      'Task',
      {
        cpu: taskCpu,
        memoryLimitMiB: taskMemory,
      },
    );
    this.appOnlyTaskDef =
      new import_aws_cdk_lib11.aws_ecs.FargateTaskDefinition(
        this,
        'AppOnlyTask',
        {
          cpu: taskCpu,
          memoryLimitMiB: taskMemory,
        },
      );
    const appContainerParams = {
      image: appContainerImage.image,
      taskDefinition: this.taskDef,
      // using the standard task def
      essential: true,
      environment: appEnvironment == null ? void 0 : appEnvironment.env,
      secrets: appEnvironment == null ? void 0 : appEnvironment.secrets,
      logging: import_aws_cdk_lib11.aws_ecs.LogDriver.awsLogs({
        streamPrefix: 'app',
        logGroup: new import_aws_cdk_lib11.aws_logs.LogGroup(
          this,
          'AppLogGroup',
          {
            logGroupName: `/${
              import_aws_cdk_lib11.Stack.of(this).stackName
            }/app`,
            removalPolicy: import_aws_cdk_lib11.RemovalPolicy.DESTROY,
            retention: logRetentionDays,
          },
        ),
      }),
    };
    this.appContainer = new import_aws_cdk_lib11.aws_ecs.ContainerDefinition(
      this,
      'AppContainer',
      appContainerParams,
    );
    this.appContainer.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
    });
    const appOnlyContainerParams = __spreadProps(
      __spreadValues({}, appContainerParams),
      {
        taskDefinition: this.appOnlyTaskDef,
      },
    );
    new import_aws_cdk_lib11.aws_ecs.ContainerDefinition(
      this,
      'AppOnlyContainer',
      appOnlyContainerParams,
    );
    const proxyContainerImage = new CacclContainerImage_default(
      this,
      'ProxyImage',
      {
        appImage: proxyImage,
      },
    );
    const environment = {
      APP_PORT: '8080',
    };
    if (props.vpcCidrBlock !== void 0) {
      environment.VPC_CIDR = props.vpcCidrBlock;
    } else {
      throw new Error('proxy contianer environment needs the vpc cidr!');
    }
    this.proxyContainer = new import_aws_cdk_lib11.aws_ecs.ContainerDefinition(
      this,
      'ProxyContainer',
      {
        image: proxyContainerImage.image,
        environment,
        essential: true,
        taskDefinition: this.taskDef,
        logging: import_aws_cdk_lib11.aws_ecs.LogDriver.awsLogs({
          streamPrefix: 'proxy',
          logGroup: new import_aws_cdk_lib11.aws_logs.LogGroup(
            this,
            'ProxyLogGroup',
            {
              logGroupName: `/${
                import_aws_cdk_lib11.Stack.of(this).stackName
              }/proxy`,
              removalPolicy: import_aws_cdk_lib11.RemovalPolicy.DESTROY,
              retention: logRetentionDays,
            },
          ),
        }),
      },
    );
    this.proxyContainer.addPortMappings({
      containerPort: 443,
      hostPort: 443,
    });
    new import_aws_cdk_lib11.CfnOutput(this, 'TaskDefinitionArn', {
      exportName: `${
        import_aws_cdk_lib11.Stack.of(this).stackName
      }-task-def-name`,
      // "family" is synonymous with "name", or at least aws frequently treats it that way
      value: this.taskDef.family,
    });
    new import_aws_cdk_lib11.CfnOutput(this, 'AppOnlyTaskDefinitionArn', {
      exportName: `${
        import_aws_cdk_lib11.Stack.of(this).stackName
      }-app-only-task-def-name`,
      // "family" is synonymous with "name", or at least aws frequently treats it that way
      value: this.appOnlyTaskDef.family,
    });
    if (props.gitRepoVolume) {
      const { repoUrlSecretArn, appContainerPath } = props.gitRepoVolume;
      if (repoUrlSecretArn === void 0) {
        throw new Error(
          'You must provide the ARN of a SecretsManager secret containing the git repo url as `deployConfig.gitRepoVolume.repoUrlSecretArn!`',
        );
      }
      if (appContainerPath === void 0) {
        throw new Error(
          'You must set `deployConfig.gitRepoVolume.appContainerPath` to the path you want the git repo volume to be mounted in your app',
        );
      }
      new CacclGitRepoVolumeContainer_default(this, 'VolumeContainer', {
        repoUrlSecretArn,
        appContainerPath,
        taskDefinition: this.taskDef,
        appContainer: this.appContainer,
      });
    }
  }
};
var CacclTaskDef_default = CacclTaskDef;

// cdk/lib/classes/CacclDocDb.ts
var import_aws_cdk_lib13 = require('aws-cdk-lib');

// cdk/lib/classes/CacclDbBase.ts
var import_aws_cdk_lib12 = require('aws-cdk-lib');
var import_constructs12 = require('constructs');

// cdk/lib/constants/DEFAULT_REMOVAL_POLICY.ts
var DEFAULT_REMOVAL_POLICY = 'DESTROY';
var DEFAULT_REMOVAL_POLICY_default = DEFAULT_REMOVAL_POLICY;

// cdk/lib/classes/CacclDbBase.ts
var CacclDbBase = class extends import_constructs12.Construct {
  // TODO: JSDoc for constructor
  constructor(scope, id, props) {
    super(scope, id);
    // overrides that get set in the cluster-level parameter group,
    // e.g. enabling performance monitoring
    this.clusterParameterGroupParams = {};
    // overrides for the instance-level param group
    // e.g. turning on slow query logging
    this.instanceParameterGroupParams = {};
    const { vpc } = props;
    const { removalPolicy = DEFAULT_REMOVAL_POLICY_default } = props.options;
    this.removalPolicy = import_aws_cdk_lib12.RemovalPolicy[removalPolicy];
    this.etcRemovalPolicy =
      this.removalPolicy === import_aws_cdk_lib12.RemovalPolicy.RETAIN
        ? import_aws_cdk_lib12.RemovalPolicy.RETAIN
        : import_aws_cdk_lib12.RemovalPolicy.DESTROY;
    this.dbPasswordSecret = new import_aws_cdk_lib12.aws_secretsmanager.Secret(
      this,
      'DbPasswordSecret',
      {
        description: `docdb master user password for ${
          import_aws_cdk_lib12.Stack.of(this).stackName
        }`,
        generateSecretString: {
          passwordLength: 16,
          excludePunctuation: true,
        },
      },
    );
    this.dbPasswordSecret.applyRemovalPolicy(this.etcRemovalPolicy);
    this.dbSg = new import_aws_cdk_lib12.aws_ec2.SecurityGroup(
      this,
      'DbSecurityGroup',
      {
        vpc,
        description: 'security group for the db cluster',
        allowAllOutbound: false,
      },
    );
    this.dbSg.applyRemovalPolicy(this.etcRemovalPolicy);
    this.dbSg.addEgressRule(
      import_aws_cdk_lib12.aws_ec2.Peer.anyIpv4(),
      import_aws_cdk_lib12.aws_ec2.Port.allTcp(),
    );
  }
  // FIXME: doesn't do anything?
  createOutputs() {
    new import_aws_cdk_lib12.CfnOutput(this, 'DbClusterEndpoint', {
      exportName: `${
        import_aws_cdk_lib12.Stack.of(this).stackName
      }-db-cluster-endpoint`,
      value: `${this.host}:${this.port}`,
    });
    new import_aws_cdk_lib12.CfnOutput(this, 'DbSecretArn', {
      exportName: `${
        import_aws_cdk_lib12.Stack.of(this).stackName
      }-db-password-secret-arn`,
      value: this.dbPasswordSecret.secretArn,
    });
  }
  addSecurityGroupIngress(vpcCidrBlock) {
    this.dbCluster.connections.allowDefaultPortInternally();
    this.dbCluster.connections.allowDefaultPortFrom(
      import_aws_cdk_lib12.aws_ec2.Peer.ipv4(vpcCidrBlock),
    );
  }
};
var CacclDbBase_default = CacclDbBase;

// cdk/lib/constants/DEFAULT_DB_INSTANCE_TYPE.ts
var DEFAULT_DB_INSTANCE_TYPE = 't3.medium';
var DEFAULT_DB_INSTANCE_TYPE_default = DEFAULT_DB_INSTANCE_TYPE;

// cdk/lib/constants/DEFAULT_DOCDB_ENGINE_VERSION.ts
var DEFAULT_DOCDB_ENGINE_VERSION = '3.6';
var DEFAULT_DOCDB_ENGINE_VERSION_default = DEFAULT_DOCDB_ENGINE_VERSION;

// cdk/lib/constants/DEFAULT_DOCDB_PARAM_GROUP_FAMILY.ts
var DEFAULT_DOCDB_PARAM_GROUP_FAMILY = 'docdb3.6';
var DEFAULT_DOCDB_PARAM_GROUP_FAMILY_default = DEFAULT_DOCDB_PARAM_GROUP_FAMILY;

// cdk/lib/classes/CacclDocDb.ts
var CacclDocDb = class extends CacclDbBase_default {
  constructor(scope, id, props) {
    super(scope, id, props);
    this.metricNamespace = 'AWS/DocDB';
    const { vpc, appEnv } = props;
    const {
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE_default,
      engineVersion = DEFAULT_DOCDB_ENGINE_VERSION_default,
      parameterGroupFamily = DEFAULT_DOCDB_PARAM_GROUP_FAMILY_default,
      profiler = false,
    } = props.options;
    if (profiler) {
      this.clusterParameterGroupParams.profiler = 'enabled';
      this.clusterParameterGroupParams.profiler_threshold_ms = '500';
    }
    const parameterGroup =
      new import_aws_cdk_lib13.aws_docdb.ClusterParameterGroup(
        this,
        'ClusterParameterGroup',
        {
          dbClusterParameterGroupName: `${
            import_aws_cdk_lib13.Stack.of(this).stackName
          }-param-group`,
          family: parameterGroupFamily,
          description: `Cluster parameter group for ${
            import_aws_cdk_lib13.Stack.of(this).stackName
          }`,
          parameters: this.clusterParameterGroupParams,
        },
      );
    this.dbCluster = new import_aws_cdk_lib13.aws_docdb.DatabaseCluster(
      this,
      'DocDbCluster',
      {
        masterUser: {
          username: 'root',
          password: import_aws_cdk_lib13.SecretValue.secretsManager(
            this.dbPasswordSecret.secretArn,
          ),
        },
        parameterGroup,
        engineVersion,
        instances: instanceCount,
        vpc,
        instanceType: new import_aws_cdk_lib13.aws_ec2.InstanceType(
          instanceType,
        ),
        vpcSubnets: {
          subnetType:
            import_aws_cdk_lib13.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroup: this.dbSg,
        backup: {
          retention: import_aws_cdk_lib13.Duration.days(14),
        },
        removalPolicy: this.removalPolicy,
      },
    );
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
      import_aws_cdk_lib13.aws_ecs.Secret.fromSecretsManager(
        this.dbPasswordSecret,
      ),
    );
    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc.vpcCidrBlock);
  }
  makeDocDbMetric(metricName, extraProps = {}) {
    const metric = new import_aws_cdk_lib13.aws_cloudwatch.Metric(
      __spreadValues(
        {
          metricName,
          namespace: this.metricNamespace,
          dimensionsMap: {
            DBClusterIdentifier: this.dbCluster.clusterIdentifier,
          },
        },
        extraProps,
      ),
    ).with({ period: import_aws_cdk_lib13.Duration.minutes(1) });
    return metric.attachTo(this.dbCluster);
  }
  createMetricsAndAlarms() {
    this.metrics = {
      ReadIOPS: [this.makeDocDbMetric('ReadIOPS')],
      WriteIOPS: [this.makeDocDbMetric('WriteIOPS')],
      CPUUtilization: [
        this.makeDocDbMetric('CPUUtilization', {
          unit: import_aws_cdk_lib13.aws_cloudwatch.Unit.PERCENT,
        }),
      ],
      FreeableMemory: [this.makeDocDbMetric('FreeableMemory')],
      BufferCacheHitRatio: [
        this.makeDocDbMetric('BufferCacheHitRatio', {
          unit: import_aws_cdk_lib13.aws_cloudwatch.Unit.PERCENT,
        }),
      ],
      DatabaseConnections: [this.makeDocDbMetric('DatabaseConnections')],
      DiskQueueDepth: [this.makeDocDbMetric('DiskQueueDepth')],
      ReadLatency: [
        this.makeDocDbMetric('ReadLatency', {
          unit: import_aws_cdk_lib13.aws_cloudwatch.Unit.MILLISECONDS,
        }),
      ],
      WriteLatency: [
        this.makeDocDbMetric('WriteLatency', {
          unit: import_aws_cdk_lib13.aws_cloudwatch.Unit.MILLISECONDS,
        }),
      ],
      DatabaseCursorsTimedOut: [
        this.makeDocDbMetric('DatabaseCursorsTimedOut', { statistic: 'sum' }),
      ],
      Transactions: [this.makeDocDbMetric('TransactionsOpen')],
      Queries: [this.makeDocDbMetric('OpcountersQuery')],
    };
    this.alarms = [
      new import_aws_cdk_lib13.aws_cloudwatch.Alarm(
        this,
        'CPUUtilizationAlarm',
        {
          metric: this.metrics.CPUUtilization[0].with({
            period: import_aws_cdk_lib13.Duration.minutes(5),
          }),
          threshold: 50,
          evaluationPeriods: 3,
          alarmDescription: `${
            import_aws_cdk_lib13.Stack.of(this).stackName
          } docdb cpu utilization alarm`,
        },
      ),
      new import_aws_cdk_lib13.aws_cloudwatch.Alarm(
        this,
        'BufferCacheHitRatioAlarm',
        {
          metric: this.metrics.BufferCacheHitRatio[0],
          threshold: 90,
          evaluationPeriods: 3,
          comparisonOperator:
            import_aws_cdk_lib13.aws_cloudwatch.ComparisonOperator
              .LESS_THAN_OR_EQUAL_TO_THRESHOLD,
          alarmDescription: `${
            import_aws_cdk_lib13.Stack.of(this).stackName
          } docdb buffer cache hit ratio alarm`,
        },
      ),
      new import_aws_cdk_lib13.aws_cloudwatch.Alarm(this, 'DiskQueueDepth', {
        metric: this.metrics.DiskQueueDepth[0],
        threshold: 1,
        evaluationPeriods: 3,
        alarmDescription: `${
          import_aws_cdk_lib13.Stack.of(this).stackName
        } docdb disk queue depth`,
      }),
      new import_aws_cdk_lib13.aws_cloudwatch.Alarm(this, 'ReadLatency', {
        metric: this.metrics.ReadLatency[0],
        threshold: 20,
        evaluationPeriods: 3,
        treatMissingData:
          import_aws_cdk_lib13.aws_cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          import_aws_cdk_lib13.Stack.of(this).stackName
        } docdb read latency alarm`,
      }),
      new import_aws_cdk_lib13.aws_cloudwatch.Alarm(this, 'WriteLatency', {
        metric: this.metrics.WriteLatency[0],
        threshold: 100,
        evaluationPeriods: 3,
        treatMissingData:
          import_aws_cdk_lib13.aws_cloudwatch.TreatMissingData.IGNORE,
        alarmDescription: `${
          import_aws_cdk_lib13.Stack.of(this).stackName
        } docdb write latency alarm`,
      }),
      new import_aws_cdk_lib13.aws_cloudwatch.Alarm(
        this,
        'DatabaseCursorsTimedOutAlarm',
        {
          metric: this.metrics.DatabaseCursorsTimedOut[0].with({
            period: import_aws_cdk_lib13.Duration.minutes(5),
          }),
          threshold: 5,
          evaluationPeriods: 3,
          alarmDescription: `${
            import_aws_cdk_lib13.Stack.of(this).stackName
          } docdb cursors timed out alarm`,
        },
      ),
    ];
  }
  getDashboardLink() {
    const { region } = import_aws_cdk_lib13.Stack.of(this);
    const dbClusterId = this.dbCluster.clusterIdentifier;
    return `https://console.aws.amazon.com/docdb/home?region=${region}#cluster-details/${dbClusterId}`;
  }
};
var CacclDocDb_default = CacclDocDb;

// cdk/lib/classes/CacclRdsDb.ts
var import_aws_cdk_lib14 = require('aws-cdk-lib');

// cdk/lib/constants/DEFAULT_AURORA_MYSQL_ENGINE_VERSION.ts
var DEFAULT_AURORA_MYSQL_ENGINE_VERSION = '5.7.mysql_aurora.2.11.2';
var DEFAULT_AURORA_MYSQL_ENGINE_VERSION_default =
  DEFAULT_AURORA_MYSQL_ENGINE_VERSION;

// cdk/lib/classes/CacclRdsDb.ts
var CacclRdsDb = class extends CacclDbBase_default {
  constructor(scope, id, props) {
    super(scope, id, props);
    this.metricNamespace = 'AWS/RDS';
    const { vpc, appEnv } = props;
    const {
      instanceCount = 1,
      instanceType = DEFAULT_DB_INSTANCE_TYPE_default,
      engineVersion = DEFAULT_AURORA_MYSQL_ENGINE_VERSION_default,
      databaseName,
    } = props.options;
    const majorVersion = engineVersion.substring(0, 3);
    const auroraMysqlEngineVersion =
      import_aws_cdk_lib14.aws_rds.DatabaseClusterEngine.auroraMysql({
        version: import_aws_cdk_lib14.aws_rds.AuroraMysqlEngineVersion.of(
          engineVersion,
          majorVersion,
        ),
      });
    const enablePerformanceInsights = !instanceType.startsWith('t3');
    this.clusterParameterGroupParams.lower_case_table_names = '1';
    if (parseInt(majorVersion, 10) < 8) {
      this.clusterParameterGroupParams.aurora_enable_repl_bin_log_filtering =
        '1';
    }
    const clusterParameterGroup =
      new import_aws_cdk_lib14.aws_rds.ParameterGroup(
        this,
        'ClusterParameterGroup',
        {
          engine: auroraMysqlEngineVersion,
          description: `RDS parameter group for ${
            import_aws_cdk_lib14.Stack.of(this).stackName
          }`,
          parameters: this.clusterParameterGroupParams,
        },
      );
    this.instanceParameterGroupParams.slow_query_log = '1';
    this.instanceParameterGroupParams.log_output = 'TABLE';
    this.instanceParameterGroupParams.long_query_time = '3';
    this.instanceParameterGroupParams.sql_mode = 'STRICT_ALL_TABLES';
    this.instanceParameterGroupParams.innodb_monitor_enable = 'all';
    const instanceParameterGroup =
      new import_aws_cdk_lib14.aws_rds.ParameterGroup(
        this,
        'InstanceParameterGroup',
        {
          engine: auroraMysqlEngineVersion,
          description: `RDS instance parameter group for ${
            import_aws_cdk_lib14.Stack.of(this).stackName
          }`,
          parameters: this.instanceParameterGroupParams,
        },
      );
    this.dbCluster = new import_aws_cdk_lib14.aws_rds.DatabaseCluster(
      this,
      'RdsDbCluster',
      {
        engine: auroraMysqlEngineVersion,
        clusterIdentifier: `${
          import_aws_cdk_lib14.Stack.of(this).stackName
        }-db-cluster`,
        credentials: {
          username: 'root',
          password: import_aws_cdk_lib14.SecretValue.secretsManager(
            this.dbPasswordSecret.secretArn,
          ),
        },
        parameterGroup: clusterParameterGroup,
        instances: instanceCount,
        defaultDatabaseName: databaseName,
        instanceProps: {
          vpc,
          instanceType: new import_aws_cdk_lib14.aws_ec2.InstanceType(
            instanceType,
          ),
          enablePerformanceInsights,
          parameterGroup: instanceParameterGroup,
          vpcSubnets: {
            subnetType:
              import_aws_cdk_lib14.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          securityGroups: [this.dbSg],
        },
        backup: {
          retention: import_aws_cdk_lib14.Duration.days(14),
        },
        removalPolicy: this.removalPolicy,
      },
    );
    clusterParameterGroup.applyRemovalPolicy(this.etcRemovalPolicy);
    instanceParameterGroup.applyRemovalPolicy(this.etcRemovalPolicy);
    this.host = this.dbCluster.clusterEndpoint.hostname;
    this.port = '3306';
    appEnv.addEnvironmentVar('DATABASE_USER', 'root');
    appEnv.addEnvironmentVar('DATABASE_PORT', this.port);
    appEnv.addEnvironmentVar('DATABASE_HOST', this.host);
    appEnv.addEnvironmentVar(
      'DATABASE_NAME',
      databaseName != null ? databaseName : '',
    );
    appEnv.addSecret(
      'DATABASE_PASSWORD',
      import_aws_cdk_lib14.aws_ecs.Secret.fromSecretsManager(
        this.dbPasswordSecret,
      ),
    );
    this.createMetricsAndAlarms();
    this.createOutputs();
    this.addSecurityGroupIngress(vpc.vpcCidrBlock);
  }
  makeInstanceMetrics(metricName, extraProps = {}) {
    return this.dbCluster.instanceIdentifiers.map((id) => {
      const metric = new import_aws_cdk_lib14.aws_cloudwatch.Metric(
        __spreadValues(
          {
            metricName,
            namespace: this.metricNamespace,
            dimensionsMap: { DBInstanceIdentifier: id },
            label: id,
          },
          extraProps,
        ),
      ).with({ period: import_aws_cdk_lib14.Duration.minutes(1) });
      return metric.attachTo(this.dbCluster);
    });
  }
  createMetricsAndAlarms() {
    this.metrics = {
      ReadIOPS: this.makeInstanceMetrics('ReadIOPS'),
      WriteIOPS: this.makeInstanceMetrics('WriteIOPS'),
      CPUUtilization: this.makeInstanceMetrics('CPUUtilization', {
        unit: import_aws_cdk_lib14.aws_cloudwatch.Unit.PERCENT,
      }),
      FreeableMemory: this.makeInstanceMetrics('FreeableMemory'),
      BufferCacheHitRatio: this.makeInstanceMetrics('BufferCacheHitRatio', {
        unit: import_aws_cdk_lib14.aws_cloudwatch.Unit.PERCENT,
      }),
      DatabaseConnections: this.makeInstanceMetrics('DatabaseConnections'),
      DiskQueueDepth: this.makeInstanceMetrics('DiskQueueDepth'),
      ReadLatency: this.makeInstanceMetrics('ReadLatency', {
        unit: import_aws_cdk_lib14.aws_cloudwatch.Unit.MILLISECONDS,
      }),
      WriteLatency: this.makeInstanceMetrics('WriteLatency', {
        unit: import_aws_cdk_lib14.aws_cloudwatch.Unit.MILLISECONDS,
      }),
      DatabaseCursorsTimedOut: this.makeInstanceMetrics(
        'DatabaseCursorsTimedOut',
        { statistic: 'sum' },
      ),
      Transactions: this.makeInstanceMetrics('ActiveTransactions'),
      Queries: this.makeInstanceMetrics('Queries'),
    };
    this.alarms = [
      ...this.metrics.ReadIOPS.map((metric, idx) => {
        return new import_aws_cdk_lib14.aws_cloudwatch.Alarm(
          this,
          `CPUUtilizationAlarm-${idx}`,
          {
            metric,
            threshold: 50,
            evaluationPeriods: 3,
            alarmDescription: `${
              import_aws_cdk_lib14.Stack.of(this).stackName
            } ${metric.label} cpu utilization alarm`,
          },
        );
      }),
      ...this.metrics.BufferCacheHitRatio.map((metric, idx) => {
        return new import_aws_cdk_lib14.aws_cloudwatch.Alarm(
          this,
          `BufferCacheHitRatioAlarm-${idx}`,
          {
            metric,
            threshold: 90,
            evaluationPeriods: 3,
            comparisonOperator:
              import_aws_cdk_lib14.aws_cloudwatch.ComparisonOperator
                .LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmDescription: `${
              import_aws_cdk_lib14.Stack.of(this).stackName
            } ${metric.label} buffer cache hit ratio alarm`,
          },
        );
      }),
      ...this.metrics.DiskQueueDepth.map((metric, idx) => {
        return new import_aws_cdk_lib14.aws_cloudwatch.Alarm(
          this,
          `DiskQueueDepth-${idx}`,
          {
            metric,
            threshold: 1,
            evaluationPeriods: 3,
            alarmDescription: `${
              import_aws_cdk_lib14.Stack.of(this).stackName
            } ${metric.label} disk queue depth`,
          },
        );
      }),
      ...this.metrics.ReadLatency.map((metric, idx) => {
        return new import_aws_cdk_lib14.aws_cloudwatch.Alarm(
          this,
          `ReadLatency-${idx}`,
          {
            metric,
            threshold: 20,
            evaluationPeriods: 3,
            treatMissingData:
              import_aws_cdk_lib14.aws_cloudwatch.TreatMissingData.IGNORE,
            alarmDescription: `${
              import_aws_cdk_lib14.Stack.of(this).stackName
            } ${metric.label} read latency alarm`,
          },
        );
      }),
      ...this.metrics.WriteLatency.map((metric, idx) => {
        return new import_aws_cdk_lib14.aws_cloudwatch.Alarm(
          this,
          `WriteLatency-${idx}`,
          {
            metric,
            threshold: 100,
            evaluationPeriods: 3,
            treatMissingData:
              import_aws_cdk_lib14.aws_cloudwatch.TreatMissingData.IGNORE,
            alarmDescription: `${
              import_aws_cdk_lib14.Stack.of(this).stackName
            } ${metric.label} write latency alarm`,
          },
        );
      }),
      ...this.metrics.DatabaseCursorsTimedOut.map((metric, idx) => {
        return new import_aws_cdk_lib14.aws_cloudwatch.Alarm(
          this,
          `DatabaseCursorsTimedOutAlarm-${idx}`,
          {
            metric,
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: `${
              import_aws_cdk_lib14.Stack.of(this).stackName
            } ${metric.label} cursors timed out alarm`,
          },
        );
      }),
    ];
  }
  getDashboardLink() {
    const { region } = import_aws_cdk_lib14.Stack.of(this);
    const dbClusterId = this.dbCluster.clusterIdentifier;
    return `https://console.aws.amazon.com/rds/home?region=${region}#database:id=${dbClusterId};is-cluster=true`;
  }
};
var CacclRdsDb_default = CacclRdsDb;

// cdk/lib/helpers/createDbConstruct.ts
var createDbConstruct = (scope, props) => {
  const { options } = props;
  switch (options.engine.toLowerCase()) {
    case 'docdb':
      return new CacclDocDb_default(scope, 'DocDb', props);
    case 'mysql':
      return new CacclRdsDb_default(scope, 'RdsDb', props);
    default:
      throw Error(`Invalid dbOptions.engine value: ${options.engine}`);
  }
};
var createDbConstruct_default = createDbConstruct;

// cdk/lib/classes/CacclDeployStack.ts
var CacclDeployStack = class extends import_aws_cdk_lib15.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    let vpc;
    let cluster;
    let createBastion = false;
    if (props.vpcId !== void 0) {
      vpc = import_aws_cdk_lib15.aws_ec2.Vpc.fromLookup(this, 'Vpc', {
        vpcId: props.vpcId,
      });
    } else {
      throw new Error('deployConfig must define a vpcId');
    }
    const appEnv = new CacclAppEnvironment_default(this, 'AppEnvironment', {
      envVars: props.appEnvironment,
    });
    appEnv.addEnvironmentVar('CIDR_NET', vpc.vpcCidrBlock);
    let db = null;
    if (props.dbOptions) {
      createBastion = true;
      db = createDbConstruct_default(this, {
        vpc,
        options: props.dbOptions,
        appEnv,
      });
    }
    if (props.cacheOptions) {
      createBastion = true;
      new CacclCache_default(this, 'Cache', {
        vpc,
        options: props.cacheOptions,
        appEnv,
      });
    }
    if (props.ecsClusterName !== void 0) {
      cluster = import_aws_cdk_lib15.aws_ecs.Cluster.fromClusterAttributes(
        this,
        'Cluster',
        {
          vpc,
          clusterName: props.ecsClusterName,
          securityGroups: [],
        },
      );
    } else {
      cluster = new import_aws_cdk_lib15.aws_ecs.Cluster(this, 'Cluster', {
        clusterName: props.stackName,
        containerInsights: true,
        vpc,
      });
    }
    const taskDef = new CacclTaskDef_default(
      this,
      'TaskDef',
      __spreadValues(
        {
          vpcCidrBlock: vpc.vpcCidrBlock,
          appEnvironment: appEnv,
        },
        props.taskDefProps,
      ),
    );
    const lbSecurityGroups = {};
    if (props.firewallSgId) {
      lbSecurityGroups.primary =
        import_aws_cdk_lib15.aws_ec2.SecurityGroup.fromSecurityGroupId(
          this,
          'SecurityGroupImport',
          props.firewallSgId,
          {
            allowAllOutbound: true,
          },
        );
      lbSecurityGroups.misc = new import_aws_cdk_lib15.aws_ec2.SecurityGroup(
        this,
        'MiscSecurityGroup',
        {
          vpc,
          description:
            'security group for miscellaneous app-specific ingress rules',
        },
      );
    } else {
      const newSg = new import_aws_cdk_lib15.aws_ec2.SecurityGroup(
        this,
        'FirewallSecurityGroup',
        {
          vpc,
          description: 'security group for the load balancer and app service',
        },
      );
      newSg.addIngressRule(
        import_aws_cdk_lib15.aws_ec2.Peer.anyIpv4(),
        import_aws_cdk_lib15.aws_ec2.Port.tcp(80),
      );
      newSg.addIngressRule(
        import_aws_cdk_lib15.aws_ec2.Peer.anyIpv4(),
        import_aws_cdk_lib15.aws_ec2.Port.tcp(443),
      );
      lbSecurityGroups.primary = newSg;
    }
    const service = new CacclService_default(this, 'EcsService', {
      cluster,
      taskDef,
      /**
       * The security group passed into the CacclService is used in a traffic source ingress rule.
       * i.e., the resulting ECS servcie will get its own security group with a single ingress rule that allows
       * traffic from any resource associated with the security group passed in here.
       */
      loadBalancerSg: lbSecurityGroups.primary,
      taskCount: props.taskCount,
      enableExecuteCommand: props.enableExecuteCommand,
    });
    const loadBalancer = new CacclLoadBalancer_default(this, 'LoadBalancer', {
      certificateArn: props.certificateArn,
      loadBalancerTarget: service.loadBalancerTarget,
      albLogBucketName: props.albLogBucketName,
      extraOptions: props.lbOptions,
      securityGroups: lbSecurityGroups,
      vpc,
    });
    const dashboard = new CacclMonitoring_default(this, 'Dashboard', {
      cacclLoadBalancer: loadBalancer,
      cacclService: service,
    });
    const notifyProps = __spreadProps(__spreadValues({}, props.notifications), {
      service,
      loadBalancer,
    });
    if (db) {
      notifyProps.db = db;
    }
    new CacclNotifications_default(this, 'Notifications', notifyProps);
    if (db) {
      dashboard.addDbSection(db);
    }
    if (createBastion) {
      let bastionSg;
      if (props.firewallSgId) {
        bastionSg = lbSecurityGroups.primary;
      } else {
        bastionSg = new import_aws_cdk_lib15.aws_ec2.SecurityGroup(
          this,
          'BastionSecurityGroup',
          {
            vpc,
            description: 'security group for the ssh bastion host',
          },
        );
        bastionSg.addIngressRule(
          import_aws_cdk_lib15.aws_ec2.Peer.anyIpv4(),
          import_aws_cdk_lib15.aws_ec2.Port.tcp(22),
        );
      }
      new CacclSshBastion_default(this, 'SshBastion', { vpc, sg: bastionSg });
    }
    if (props.scheduledTasks) {
      const scheduledTasks = new CacclScheduledTasks_default(
        this,
        'ScheduledTasks',
        {
          vpc,
          scheduledTasks: props.scheduledTasks,
          clusterName: cluster.clusterName,
          serviceName: service.ecsService.serviceName,
          taskDefinition: taskDef.appOnlyTaskDef,
        },
      );
      dashboard.addScheduledTasksSection(scheduledTasks);
    }
  }
};
var CacclDeployStack_default = CacclDeployStack;

// types/CacclCacheOptions.ts
var import_zod = require('zod');
var CacclCacheOptions = import_zod.z.object({
  engine: import_zod.z.string(),
  numCacheNodes: import_zod.z.number().optional(),
  cacheNodeType: import_zod.z.string().optional(),
});
var CacclCacheOptions_default = CacclCacheOptions;

// types/CacclDbEngine.ts
var import_zod2 = require('zod');
var CacclDbEngine = import_zod2.z.enum(['docdb', 'mysql']);
var CacclDbEngine_default = CacclDbEngine;

// types/CacclDbOptions.ts
var import_zod3 = require('zod');
var CacclDbOptions = import_zod3.z.object({
  // currently either 'docdb' or 'mysql'
  engine: CacclDbEngine_default,
  // see the aws docs for supported types
  instanceType: import_zod3.z.string().optional(),
  // > 1 will get you multi-az
  instanceCount: import_zod3.z.number().optional(),
  // use a non-default engine version (shouldn't be necessary)
  engineVersion: import_zod3.z.string().optional(),
  // use a non-default parameter group family (also unnecessary)
  parameterGroupFamily: import_zod3.z.string().optional(),
  // only used by docdb, turns on extra profiling
  profiler: import_zod3.z.boolean().optional(),
  // only used by mysql, provisioning will create the named database
  databaseName: import_zod3.z.string().optional(),
  // removal policy controls what happens to the db if it's replaced or otherwise stops being managed by CloudFormation
  removalPolicy: import_zod3.z.string().optional(),
});
var CacclDbOptions_default = CacclDbOptions;

// types/CacclDeployStackPropsData.ts
var import_zod8 = require('zod');

// types/DeployConfigData.ts
var import_zod7 = require('zod');

// types/CacclLoadBalancerExtraOptions.ts
var import_zod4 = require('zod');
var CacclLoadBalancerExtraOptions = import_zod4.z.object({
  healthCheckPath: import_zod4.z.string().optional(),
  targetDeregistrationDelay: import_zod4.z.number().optional(),
});
var CacclLoadBalancerExtraOptions_default = CacclLoadBalancerExtraOptions;

// types/CacclNotificationsProps.ts
var import_zod5 = require('zod');
var CacclNotificationsProps = import_zod5.z.object({
  email: import_zod5.z
    .union([import_zod5.z.string(), import_zod5.z.string().array()])
    .optional(),
  slack: import_zod5.z.string().optional(),
});
var CacclNotificationsProps_default = CacclNotificationsProps;

// types/CacclScheduledTask.ts
var import_zod6 = require('zod');
var CacclScheduledTask = import_zod6.z.object({
  description: import_zod6.z.string().optional(),
  schedule: import_zod6.z.string(),
  command: import_zod6.z.string(),
});
var CacclScheduledTask_default = CacclScheduledTask;

// types/DeployConfigData.ts
var DeployConfigData = import_zod7.z.object({
  //
  appImage: import_zod7.z.string(),
  proxyImage: import_zod7.z.string().optional(),
  taskCpu: import_zod7.z.number().optional(),
  taskMemory: import_zod7.z.number().optional(),
  logRetentionDays: import_zod7.z.number().optional(),
  gitRepoVolume: import_zod7.z
    .object({})
    .catchall(import_zod7.z.string())
    .optional(),
  // CloudFormation infrastructure stack name
  infraStackName: import_zod7.z.string(),
  // Container image ARN
  notifications: CacclNotificationsProps_default.optional(),
  certificateArn: import_zod7.z.string().optional(),
  appEnvironment: import_zod7.z
    .object({})
    .catchall(import_zod7.z.string())
    .optional(),
  tags: import_zod7.z.object({}).catchall(import_zod7.z.string()).optional(),
  scheduledTasks: import_zod7.z
    .object({})
    .catchall(CacclScheduledTask_default)
    .optional(),
  taskCount: import_zod7.z.string(),
  firewallSgId: import_zod7.z.string().optional(),
  lbOptions: CacclLoadBalancerExtraOptions_default.optional(),
  cacheOptions: CacclCacheOptions_default.optional(),
  dbOptions: CacclDbOptions_default.optional(),
  enableExecuteCommand: import_zod7.z
    .union([import_zod7.z.string(), import_zod7.z.boolean()])
    .optional(),
  // DEPRECATED:
  docDb: import_zod7.z.any(),
  docDbInstanceCount: import_zod7.z.number().optional(),
  docDbInstanceType: import_zod7.z.string().optional(),
  docDbProfiler: import_zod7.z.boolean().optional(),
});
var DeployConfigData_default = DeployConfigData;

// types/CacclDeployStackPropsData.ts
var CacclDeployStackPropsData = import_zod8.z.object({
  stackName: import_zod8.z.string(),
  vpcId: import_zod8.z.string().optional(),
  ecsClusterName: import_zod8.z.string().optional(),
  albLogBucketName: import_zod8.z.string().optional(),
  awsRegion: import_zod8.z.string().optional(),
  awsAccountId: import_zod8.z.string().optional(),
  cacclDeployVersion: import_zod8.z.string(),
  deployConfigHash: import_zod8.z.string(),
  deployConfig: DeployConfigData_default,
});
var CacclDeployStackPropsData_default = CacclDeployStackPropsData;

// cdk/cdk.ts
if (process.env.CDK_STACK_PROPS_FILE_PATH === void 0) {
  throw new Error();
}
var stackPropsData = CacclDeployStackPropsData_default.parse(
  JSON.parse(
    (0, import_fs2.readFileSync)(process.env.CDK_STACK_PROPS_FILE_PATH, 'utf8'),
  ),
);
var {
  stackName,
  vpcId,
  ecsClusterName,
  awsRegion,
  awsAccountId,
  cacclDeployVersion,
  albLogBucketName,
  deployConfigHash,
  deployConfig,
} = stackPropsData;
var _a, _b, _c;
var stackProps = {
  // the CloudFormation stack name, e.g. "CacclDeploy-foo-app"
  stackName,
  // id of the shared vpc we're deploying to
  vpcId,
  // name of the shared ECS cluster we're deploying to
  ecsClusterName,
  // shared s3 bucket where the application load balancer logs will end up
  albLogBucketName,
  // ARN of the ssl certificate
  certificateArn: deployConfig.certificateArn,
  // object that defines the environment variables that will be injected into the app container
  appEnvironment: (_a = deployConfig.appEnvironment) != null ? _a : {},
  // email and slack endpoints
  notifications: (_b = deployConfig.notifications) != null ? _b : {},
  // settings for the fargate task
  taskDefProps: {
    appImage: deployConfig.appImage,
    proxyImage: deployConfig.proxyImage,
    taskCpu: deployConfig.taskCpu,
    taskMemory: deployConfig.taskMemory,
    logRetentionDays: deployConfig.logRetentionDays,
    gitRepoVolume: deployConfig.gitRepoVolume,
  },
  // how many concurrent tasks to run
  taskCount: +((_c = deployConfig.taskCount) != null ? _c : 1),
  // settings for the load balancer & load balancer targets
  lbOptions: deployConfig.lbOptions,
  // optionally attach a restrictive security group
  firewallSgId: deployConfig.firewallSgId,
  // add an elasticache/redis instance (e.g. for use by django)
  cacheOptions: deployConfig.cacheOptions,
  // settings for a database
  dbOptions: deployConfig.dbOptions,
  // settings to run tasks like cronjobs
  scheduledTasks: deployConfig.scheduledTasks,
  enableExecuteCommand: (0, import_yn.default)(
    deployConfig.enableExecuteCommand,
  ),
  tags: __spreadValues(
    {
      caccl_deploy_stack_name: stackName,
    },
    deployConfig.tags,
  ),
  env: {
    account: awsAccountId,
    region: awsRegion,
  },
};
if ((0, import_yn.default)(deployConfig.docDb)) {
  stackProps.dbOptions = {
    engine: 'docdb',
    instanceCount: deployConfig.docDbInstanceCount,
    instanceType: deployConfig.docDbInstanceType,
    profiler: deployConfig.docDbProfiler,
  };
}
var app = new import_aws_cdk_lib16.App();
var stack = new CacclDeployStack_default(app, stackName, stackProps);
new import_aws_cdk_lib16.CfnOutput(stack, 'DeployConfigHash', {
  exportName: `${stackName}-deploy-config-hash`,
  value: deployConfigHash,
});
new import_aws_cdk_lib16.CfnOutput(stack, 'CacclDeployVersion', {
  exportName: `${stackName}-caccl-deploy-version`,
  value: cacclDeployVersion,
});
app.synth();
