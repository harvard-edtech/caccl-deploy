import { aws_ec2 as ec2, aws_ecs as ecs, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { CacclAppEnvironment } from './appEnvironment';
import { CacclSshBastion } from './bastion';
import { CacclCache, CacclCacheOptions } from './cache';
import { CacclMonitoring } from './dashboard';
import { CacclDbOptions, createDbConstruct } from './db';
import {
  CacclLoadBalancer,
  LoadBalancerSecurityGoups,
  CacclLoadBalancerExtraOptions,
} from './lb';
import { CacclNotifications, CacclNotificationsProps } from './notify';
import { CacclScheduledTask, CacclScheduledTasks } from './scheduledTasks';
import { CacclService } from './service';
import { CacclTaskDef, CacclTaskDefProps } from './taskdef';

export interface CacclDeployStackProps extends StackProps {
  vpcId?: string;
  certificateArn: string;
  bastionAmiId: string;
  ecsClusterName?: string;
  appEnvironment: { [key: string]: string };
  taskDefProps: CacclTaskDefProps;
  taskCount: number;
  notifications: CacclNotificationsProps;
  albLogBucketName?: string;
  cacheOptions?: CacclCacheOptions;
  dbOptions?: CacclDbOptions;
  scheduledTasks?: { [key: string]: CacclScheduledTask };
  lbOptions?: CacclLoadBalancerExtraOptions;
  firewallSgId?: string;
  enableExecuteCommand?: boolean;
}

export class CacclDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CacclDeployStackProps) {
    super(scope, id, props as StackProps);

    let vpc;
    let cluster;

    // should we create an ssh bastion for access to db/cache/etc
    let createBastion = false;

    if (props.vpcId !== undefined) {
      vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
        vpcId: props.vpcId,
      }) as ec2.Vpc;
    } else {
      throw new Error('deployConfig must define a vpcId');
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
      db = createDbConstruct(this, {
        vpc,
        options: props.dbOptions,
        appEnv,
      });
    }

    if (props.cacheOptions) {
      createBastion = true;
      new CacclCache(this, 'Cache', {
        vpc,
        options: props.cacheOptions,
        appEnv,
      });
    }

    if (props.ecsClusterName !== undefined) {
      cluster = ecs.Cluster.fromClusterAttributes(this, 'Cluster', {
        vpc,
        clusterName: props.ecsClusterName,
        securityGroups: [],
      }) as ecs.Cluster;
    } else {
      cluster = new ecs.Cluster(this, 'Cluster', {
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

    const lbSecurityGroups: LoadBalancerSecurityGoups = {};

    if (props.firewallSgId) {
      // primary firewall will be the imported, shared security group
      lbSecurityGroups.primary = ec2.SecurityGroup.fromSecurityGroupId(
        this,
        'SecurityGroupImport',
        props.firewallSgId,
        {
          allowAllOutbound: true,
        },
      ) as ec2.SecurityGroup;

      // we also need a separate, app-specific security group for miscellaneous
      lbSecurityGroups.misc = new ec2.SecurityGroup(this, 'MiscSecurityGroup', {
        vpc,
        description:
          'security group for miscellaneous app-specific ingress rules',
      });
    } else {
      // primary will be a new, "open" security group
      const newSg = new ec2.SecurityGroup(this, 'FirewallSecurityGroup', {
        vpc,
        description: 'security group for the load balancer and app service',
      });

      // by default apps are public
      newSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      newSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

      lbSecurityGroups.primary = newSg;
    }

    const service = new CacclService(this, 'EcsService', {
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

    const loadBalancer = new CacclLoadBalancer(this, 'LoadBalancer', {
      certificateArn: props.certificateArn,
      loadBalancerTarget: service.loadBalancerTarget,
      albLogBucketName: props.albLogBucketName,
      extraOptions: props.lbOptions,
      securityGroups: lbSecurityGroups,
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
        bastionSg = lbSecurityGroups.primary;
      } else {
        bastionSg = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
          vpc,
          description: 'security group for the ssh bastion host',
        });
        bastionSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
      }
      new CacclSshBastion(this, 'SshBastion', {
        vpc,
        bastionAmiId: props.bastionAmiId,
        sg: bastionSg,
      });
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
