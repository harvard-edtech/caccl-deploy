import {
  Stack,
  type StackProps,
  aws_ec2 as ec2,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import shared types

// Import helpers

import {
  type CacclDeployStackProps,
  CacclNotificationsProps,
  type LoadBalancerSecurityGroups,
} from '../../../types/index.js';
import createDbConstruct from '../helpers/createDbConstruct.js';
// Import classes
import CacclAppEnvironment from './CacclAppEnvironment.js';
import CacclCache from './CacclCache.js';
import CacclLoadBalancer from './CacclLoadBalancer.js';
import CacclMonitoring from './CacclMonitoring.js';
import CacclNotifications from './CacclNotifications.js';
import CacclScheduledTasks from './CacclScheduledTasks.js';
import CacclService from './CacclService.js';
import CacclSshBastion from './CacclSshBastion.js';
import CacclTaskDef from './CacclTaskDef.js';

class CacclDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CacclDeployStackProps) {
    super(scope, id, props as StackProps);

    let vpc;

    // should we create an ssh bastion for access to db/cache/etc
    let createBastion = false;

    if (props.vpcId === undefined) {
      throw new Error('deployConfig must define a vpcId');
    } else {
      vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
        vpcId: props.vpcId,
      }) as ec2.Vpc;
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
        appEnv,
        options: props.dbOptions,
        vpc,
      });
    }

    if (props.cacheOptions) {
      createBastion = true;
      new CacclCache(this, 'Cache', {
        appEnv,
        options: props.cacheOptions,
        vpc,
      });
    }

    const cluster =
      props.ecsClusterName === undefined
        ? new ecs.Cluster(this, 'Cluster', {
            clusterName: props.stackName,
            containerInsights: true,
            vpc,
          })
        : (ecs.Cluster.fromClusterAttributes(this, 'Cluster', {
            clusterName: props.ecsClusterName,
            securityGroups: [],
            vpc,
          }) as ecs.Cluster);

    const taskDef = new CacclTaskDef(this, 'TaskDef', {
      appEnvironment: appEnv,
      vpcCidrBlock: vpc.vpcCidrBlock,
      ...props.taskDefProps,
    });

    const lbSecurityGroups: LoadBalancerSecurityGroups = {};

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
        description:
          'security group for miscellaneous app-specific ingress rules',
        vpc,
      });
    } else {
      // primary will be a new, "open" security group
      const newSg = new ec2.SecurityGroup(this, 'FirewallSecurityGroup', {
        description: 'security group for the load balancer and app service',
        vpc,
      });

      // by default apps are public
      newSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      newSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

      lbSecurityGroups.primary = newSg;
    }

    const service = new CacclService(this, 'EcsService', {
      cluster,
      enableExecuteCommand: props.enableExecuteCommand,
      /**
       * The security group passed into the CacclService is used in a traffic source ingress rule.
       * i.e., the resulting ECS servcie will get its own security group with a single ingress rule that allows
       * traffic from any resource associated with the security group passed in here.
       */
      loadBalancerSg: lbSecurityGroups.primary,
      taskCount: props.taskCount,
      taskDef,
    });

    const loadBalancer = new CacclLoadBalancer(this, 'LoadBalancer', {
      albLogBucketName: props.albLogBucketName,
      certificateArn: props.certificateArn,
      extraOptions: props.lbOptions,
      loadBalancerTarget: service.loadBalancerTarget,
      securityGroups: lbSecurityGroups,
      vpc,
    });

    const dashboard = new CacclMonitoring(this, 'Dashboard', {
      cacclLoadBalancer: loadBalancer,
      cacclService: service,
    });

    const notifyProps: CacclNotificationsProps = {
      ...props.notifications,
      loadBalancer,
      service,
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
          description: 'security group for the ssh bastion host',
          vpc,
        });
        bastionSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
      }

      new CacclSshBastion(this, 'SshBastion', { sg: bastionSg, vpc });
    }

    if (props.scheduledTasks) {
      const scheduledTasks = new CacclScheduledTasks(this, 'ScheduledTasks', {
        clusterName: cluster.clusterName,
        scheduledTasks: props.scheduledTasks,
        serviceName: service.ecsService.serviceName,
        taskDefinition: taskDef.appOnlyTaskDef,
        vpc,
      });
      dashboard.addScheduledTasksSection(scheduledTasks);
    }
  }
}

export default CacclDeployStack;
