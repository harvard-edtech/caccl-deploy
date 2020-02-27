import { Construct, Stack, Duration } from '@aws-cdk/core';
import {
  ApplicationLoadBalancer,
  CfnListener,
  ApplicationProtocol,
  ApplicationListener,
  ContentType,
  ApplicationTargetGroup,
  TargetType
} from '@aws-cdk/aws-elasticloadbalancingv2';
import { SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { IEcsLoadBalancerTarget } from '@aws-cdk/aws-ecs';

export interface AlbConstructProps {
  vpc: Vpc,
  securityGroup: SecurityGroup,
  certificateArn: string,
  loadBalancerTarget: IEcsLoadBalancerTarget,
};

export class AlbConstruct extends Construct {

  readonly loadBalancer: ApplicationLoadBalancer;
  readonly httpsListener: ApplicationListener;

  constructor(scope: Construct, id: string, props: AlbConstructProps) {
    super(scope, id);

    const {
      vpc,
      securityGroup,
      certificateArn,
      loadBalancerTarget,
    } = props;

    this.loadBalancer = new ApplicationLoadBalancer(this,
      'ApplicationLoadBalancer', {
        vpc,
        securityGroup,
        internetFacing: true,
      }
    );

    new CfnListener(this,
      'HttpRedirect', {
        loadBalancerArn: this.loadBalancer.loadBalancerArn,
        protocol: ApplicationProtocol.HTTP,
        port: 80,
        defaultActions: [{
          type: 'redirect',
          redirectConfig: {
            statusCode: 'HTTP_301',
            port: '443',
            protocol: 'HTTPS',
            host: '#{host}',
            path: '/#{path}',
            query: '#{query}',
          },
        }],
      }
    );

    const httpsListener = new ApplicationListener(this, 'HttpsListener', {
        loadBalancer: this.loadBalancer,
        certificates: [{
          certificateArn: certificateArn,
        }],
        port: 443,
        protocol: ApplicationProtocol.HTTPS,
      });

    const appTargetGroup = new ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      targetGroupName: `${ Stack.of(this).stackName }-proxy`,
      stickinessCookieDuration: Duration.seconds(300),
      targetType: TargetType.IP,
      targets: [loadBalancerTarget],
    });

    httpsListener.addTargetGroups(`${Stack.of(this).stackName}-tg`, {
      targetGroups: [appTargetGroup],
    });
  }
};
