// Import AWS CDK lib
import {
  aws_cloudwatch as cloudwatch,
  aws_ec2 as ec2,
  aws_elasticache as elasticache,
  Stack,
  CfnOutput,
} from 'aws-cdk-lib';

// Import AWS constructs
import { Construct } from 'constructs';

// Import shared types
import { CacclCacheProps } from '../../../types';

class CacclCache extends Construct {
  cache: elasticache.CfnCacheCluster;

  cacheSg: ec2.SecurityGroup;

  metrics: { [key: string]: cloudwatch.Metric };

  alarms: cloudwatch.Alarm[];

  constructor(scope: Construct, id: string, props: CacclCacheProps) {
    super(scope, id);

    const { vpc, appEnv } = props;
    const {
      engine = 'redis',
      numCacheNodes = 1,
      cacheNodeType = 'cache.t3.medium',
    } = props.options;

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
      vpc,
      description: 'security group for the elasticache cluster',
      allowAllOutbound: false,
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
}

export default CacclCache;
