// Import AWS CDK lib
import {
  CfnOutput,
  Stack,
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_elasticache as elasticache,
} from 'aws-cdk-lib';
// Import AWS constructs
import { Construct } from 'constructs';

// Import shared types
import { type CacclCacheProps } from '../../../types/index.js';

class CacclCache extends Construct {
  alarms: cloudwatch.Alarm[] = [];

  cache: elasticache.CfnCacheCluster;

  cacheSg: ec2.SecurityGroup;

  metrics: { [key: string]: cloudwatch.Metric } = {};

  constructor(scope: Construct, id: string, props: CacclCacheProps) {
    super(scope, id);

    const { appEnv, options, vpc } = props;
    const {
      cacheNodeType = 'cache.t3.medium',
      engine = 'redis',
      numCacheNodes = 1,
    } = options;

    const subnetGroup = new elasticache.CfnSubnetGroup(
      this,
      'CacheSubnetGroup',
      {
        description: `List of subnets for ${Stack.of(this).stackName}`,
        subnetIds: vpc.privateSubnets.map((subnet) => {
          return subnet.subnetId;
        }),
      },
    );

    this.cacheSg = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      allowAllOutbound: false,
      description: 'security group for the elasticache cluster',
      vpc,
    });

    this.cacheSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'allow from internal network',
    );

    /**
     * why do we `allowAllOutbound: false` just above and then undo it here?
     * because CDK complains if we don't. something about allowAllOutbound
     * not allowing IPv6 traffic so they had to add a warning?
     */
    this.cacheSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

    this.cache = new elasticache.CfnCacheCluster(this, 'CacheCluster', {
      cacheNodeType,
      cacheSubnetGroupName: subnetGroup.ref,
      engine,
      numCacheNodes,
      vpcSecurityGroupIds: [this.cacheSg.securityGroupId],
    });

    appEnv.addEnvironmentVar('REDIS_HOST', this.cache.attrRedisEndpointAddress);
    appEnv.addEnvironmentVar('REDIS_PORT', this.cache.attrRedisEndpointPort);

    new CfnOutput(this, 'CacheClusterEndpoint', {
      exportName: `${Stack.of(this).stackName}-cache-endpoint`,
      value: `${this.cache.attrRedisEndpointAddress}:6379`,
    });
  }
}

export default CacclCache;
