import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Stack, Construct, StackProps } from '@aws-cdk/core';

import { CacclAppEnvironment } from './appEnvironment';
import { CacclMonitoring } from './dashboard';
import { CacclDbOptions, CacclDb } from './db';
import { CacclLoadBalancer } from './lb';
import { CacclNotifications, CacclNotificationsProps } from './notify';
import { CacclCache, CacclCacheOptions } from './cache';
import { CacclService } from './service';
import { CacclTaskDef, CacclTaskDefProps } from './taskdef';
import { CacclSshBastion } from './bastion';

export interface CacclDeployStackProps extends StackProps {
  vpcId?: string;
  cidrBlock?: string;
  maxAzs: number;
  certificateArn: string;
  ecsClusterName?: string;
  appEnvironment: { [key: string]: string; };
  taskDefProps: CacclTaskDefProps;
  taskCount: number;
  notifications: CacclNotificationsProps;
  albLogBucketName?: string;
  cacheOptions?: CacclCacheOptions;
  dbOptions?: CacclDbOptions;
  bastionAmiMap?: { [key: string]: string; };
}

export class CacclDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CacclDeployStackProps) {
    super(scope, id, props as StackProps);

    let vpc;
    let cluster;

    // should we create an ssh bastion for access to db/cache/etc
    let createBastion = false;

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

    const sg = new SecurityGroup(this, 'SecurityGroup', {
      allowAllOutbound: true,
      vpc,
    });

    const appEnv = new CacclAppEnvironment(this, 'AppEnvironment', {
      envVars: props.appEnvironment,
    });
    appEnv.addEnvironmentVar('CIDR_NET', vpc.vpcCidrBlock);

    /**
     * create the docdb if needed so we can add it's endpoint url
     * to the app container's env
     */
    let db = null;
    if (props.dbOptions) {
      createBastion = true;
      db = CacclDb.createDbConstruct(this, {
        vpc,
        options: props.dbOptions,
        appEnv,
      });
    }

    let cache = null;
    if (props.cacheOptions) {
      createBastion = true;
      cache = new CacclCache(this, 'Cache', {
        vpc,
        sg,
        options: props.cacheOptions,
        appEnv,
      });
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
      albLogBucketName: props.albLogBucketName,
      vpc,
      sg,
    });

    const dashboard = new CacclMonitoring(this, 'Dashboard', {
      cacclLoadBalancer: loadBalancer,
      cacclService: service,
    });

    const notifyProps: CacclNotificationsProps = {
      ...props.notifications,
      service,
      loadBalancer,
    };

    if (db) {
      notifyProps.db = db;
    }

    new CacclNotifications(this, 'Notifications', notifyProps);

    if (db) {
      dashboard.addDbSection(db);
    }

    if (createBastion) {
      new CacclSshBastion(this, 'SshBastion', { vpc });
    }
  }
}
