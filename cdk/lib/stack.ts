import { Vpc, SecurityGroup, Peer, Port } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Stack, Construct, StackProps } from '@aws-cdk/core';

import { CacclAppEnvironment } from './appEnvironment';
import { CacclMonitoring } from './dashboard';
import { CacclDbOptions, CacclDbBase } from './db';
import { CacclLoadBalancer } from './lb';
import { CacclNotifications, CacclNotificationsProps } from './notify';
import { CacclCache, CacclCacheOptions } from './cache';
import { CacclService } from './service';
import { CacclTaskDef, CacclTaskDefProps } from './taskdef';
import { CacclSshBastion } from './bastion';
import { CacclScheduledTask, CacclScheduledTasks } from './scheduledTasks';

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
  scheduledTasks?: { [key: string]: CacclScheduledTask };
  targetDeregistrationDelay?: number; // in seconds
  firewallSgId?: string;
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
      db = CacclDbBase.createDbConstruct(this, {
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

    let firewallSg;
    if (props.firewallSgId) {
      // import the security group
      firewallSg = SecurityGroup.fromSecurityGroupId(this, 'SecurityGroupImport', props.firewallSgId, {
        allowAllOutbound: true,
      }) as SecurityGroup;
      // re-use for the bastion host
    } else {
      firewallSg = new SecurityGroup(this, 'FirewallSecurityGroup', {
        vpc,
        description: 'security group for the load balancer and app service',
      });

      // by default apps are public
      firewallSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80))
      firewallSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
    }

    const service = new CacclService(this, 'EcsService', {
      cluster,
      taskDef,
      loadBalancerSg: firewallSg,
      taskCount: props.taskCount,
    });

    const loadBalancer = new CacclLoadBalancer(this, 'LoadBalancer', {
      certificateArn: props.certificateArn,
      loadBalancerTarget: service.loadBalancerTarget,
      albLogBucketName: props.albLogBucketName,
      targetDeregistrationDelay: props.targetDeregistrationDelay,
      sg: firewallSg,
      vpc,
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
      let bastionSg;
      if (props.firewallSgId) {
        bastionSg = firewallSg;
      } else {
        bastionSg = new SecurityGroup(this, 'BastionSecurityGroup', {
          vpc,
          description: 'security group for the ssh bastion host',
        })
        bastionSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));
      }
      new CacclSshBastion(this, 'SshBastion', { vpc, sg: bastionSg });
    }

    if (props.scheduledTasks) {
      const scheduledTasks = new CacclScheduledTasks(this, 'ScheduledTasks', {
        vpc,
        scheduledTasks: props.scheduledTasks,
        clusterName: cluster.clusterName,
        serviceName: service.ecsService.serviceName,
        taskDefinition: taskDef.appOnlyTaskDef,
      });
      dashboard.addScheduledTasksSection(scheduledTasks);
    }
  }
}
