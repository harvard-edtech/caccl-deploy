import { Construct, Stack } from '@aws-cdk/core';
import { CfnCacheCluster, CfnSubnetGroup } from '@aws-cdk/aws-elasticache';
import { Alarm, Metric } from '@aws-cdk/aws-cloudwatch';
import { Peer, Port, SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { CacclAppEnvironment } from './appEnvironment';

export interface CacclCacheOptions {
  engine: string,
  numCacheNodes?: number,
  cacheNodeType?: string,
};

export interface CacclCacheProps {
  vpc: Vpc,
  sg: SecurityGroup,
  options: CacclCacheOptions,
  appEnv: CacclAppEnvironment,
};

export class CacclCache extends Construct {
  cache: CfnCacheCluster;
  metrics: { [key: string]: Metric; };
  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclCacheProps) {
    super(scope, id);

    const { vpc, sg, appEnv } = props;
    const {
      engine = 'redis',
      numCacheNodes = 1,
      cacheNodeType = 'cache.t3.medium',
    } = props.options;

    const subnetGroup = new CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: `List of subnets for ${Stack.of(this).stackName}`,
      subnetIds: vpc.privateSubnets.map((subnet) => {
        return subnet.subnetId;
      }),
    });

    this.cache = new CfnCacheCluster(this, 'CacheCluster', {
      engine,
      numCacheNodes,
      cacheNodeType,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [sg.securityGroupId],
    });

    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(6379));

    appEnv.addEnvironmentVar('REDIS_HOST', this.cache.attrRedisEndpointAddress);
    appEnv.addEnvironmentVar('REDIS_PORT', this.cache.attrRedisEndpointPort);
  }
};
