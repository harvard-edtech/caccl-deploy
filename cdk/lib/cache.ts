import { CfnOutput, Construct, Stack } from '@aws-cdk/core';
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
  options: CacclCacheOptions,
  appEnv: CacclAppEnvironment,
};

export class CacclCache extends Construct {
  cache: CfnCacheCluster;
  cacheSg: SecurityGroup;
  metrics: { [key: string]: Metric; };
  alarms: Alarm[];

  constructor(scope: Construct, id: string, props: CacclCacheProps) {
    super(scope, id);

    const { vpc, appEnv } = props;
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

    this.cacheSg = new SecurityGroup(this, 'CacheSecurityGroup', {
      vpc,
      description: 'security group for the elasticache cluster',
      allowAllOutbound: false,
    });

    this.cacheSg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(6379), 'allow from internal network');

    /**
     * why do we `allowAllOutbound: false` just above and then undo it here?
     * because CDK complains if we don't. something about allowAllOutbound
     * not allowing IPv6 traffic so they had to add a warning?
     */
    this.cacheSg.addEgressRule(Peer.anyIpv4(), Port.allTcp());

    this.cache = new CfnCacheCluster(this, 'CacheCluster', {
      engine,
      numCacheNodes,
      cacheNodeType,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [this.cacheSg.securityGroupId],
    });

    appEnv.addEnvironmentVar('REDIS_HOST', this.cache.attrRedisEndpointAddress);
    appEnv.addEnvironmentVar('REDIS_PORT', this.cache.attrRedisEndpointPort);

    new CfnOutput(this, 'CacheClusterEndpoint', {
      exportName: `${Stack.of(this).stackName}-cache-endpoint`,
      value: `${this.cache.attrRedisEndpointAddress}:6379`,
    });

  }
};
