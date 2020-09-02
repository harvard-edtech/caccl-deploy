import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster, Secret } from '@aws-cdk/aws-ecs';
import { Stack, Construct, StackProps } from '@aws-cdk/core';
import { CacclAppEnvironment } from './appEnvironment';
import { CacclMonitoring } from './dashboard';
import { CacclDocDb } from './docdb';
import { CacclLoadBalancer } from './lb';
import { CacclNotifications, CacclNotificationsProps } from './notify';
import { CacclService } from './service';
import { CacclTaskDef, CacclTaskDefProps } from './taskdef';

export interface CacclDocDbOptions {
  instanceType: string;
  instanceCount: number;
}

export interface CacclDeployStackProps extends StackProps {
  vpcId?: string;
  cidrBlock?: string;
  maxAzs: number;
  certificateArn: string;
  ecsClusterName?: string;
  appEnvironment: { [key: string]: string };
  taskDefProps: CacclTaskDefProps;
  taskCount: number;
  docDbOptions?: CacclDocDbOptions;
  notifications: CacclNotificationsProps;
  loadBalancerLogBucket?: string;
}

export class CacclDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CacclDeployStackProps) {
    super(scope, id, props as StackProps);

    let vpc;
    let cluster;

    if (props.vpcId !== undefined) {
      vpc = Vpc.fromLookup(this, 'Vpc', {
        vpcId: props.vpcId,
      }) as Vpc;
    } else if (props.cidrBlock !== undefined) {
      vpc = new Vpc(this, 'Vpc', {
        cidr: props.cidrBlock,
        maxAzs: props.maxAzs,
      });
    } else {
      throw new Error('deployConfig must define either cidrBlock or vpcId');
    }

    const appEnv = new CacclAppEnvironment(this, 'AppEnvironment', {
      envVars: props.appEnvironment,
    });

    /**
     * create the docdb if needed so we can add it's endpoint url
     * to the app container's env
     */
    let docdb = null;
    if (props.docDbOptions !== undefined) {
      docdb = new CacclDocDb(this, 'DocDb', {
        ...props.docDbOptions,
        vpc,
      });
      appEnv.addEnvironmentVar('MONGO_USER', 'root');
      appEnv.addEnvironmentVar('MONGO_HOST', docdb.host);
      appEnv.addEnvironmentVar('MONGO_OPTIONS', 'tls=true&tlsAllowInvalidCertificates=true');
      appEnv.addSecret('MONGO_PASS', Secret.fromSecretsManager(docdb.dbPasswordSecret));
    }

    if (props.ecsClusterName !== undefined) {
      cluster = Cluster.fromClusterAttributes(this, 'Cluster', {
        vpc,
        clusterName: props.ecsClusterName,
        securityGroups: [],
      }) as Cluster;
    } else {
      cluster = new Cluster(this, 'Cluster', {
        clusterName: props.stackName,
        containerInsights: true,
        vpc,
      });
    }

    const sg = new SecurityGroup(this, 'SecurityGroup', {
      allowAllOutbound: true,
      vpc,
    });

    const taskDef = new CacclTaskDef(this, 'TaskDef', {
      vpcCidrBlock: vpc.vpcCidrBlock,
      appEnvironment: appEnv,
      ...props.taskDefProps,
    });

    const service = new CacclService(this, 'EcsService', {
      sg,
      cluster,
      taskDef,
      taskCount: props.taskCount,
    });

    const loadBalancer = new CacclLoadBalancer(this, 'LoadBalancer', {
      certificateArn: props.certificateArn,
      loadBalancerTarget: service.loadBalancerTarget,
      loadBalancerLogBucket: props.loadBalancerLogBucket,
      vpc,
      sg,
    });

    const dashboard = new CacclMonitoring(this, 'Dashboard', {
      cacclLoadBalancer: loadBalancer,
      cacclService: service,
    });

    new CacclNotifications(this, 'Notifications', {
      ...props.notifications,
      service,
      loadBalancer,
    });

    if (docdb !== null) {
      dashboard.addDocDbSection(docdb);
    }
  }
}
