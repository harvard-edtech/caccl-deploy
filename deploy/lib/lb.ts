import { Construct, Duration } from '@aws-cdk/core';
import { SecurityGroup, Vpc, Peer, Port } from '@aws-cdk/aws-ec2';
import { IEcsLoadBalancerTarget } from '@aws-cdk/aws-ecs';
import {
  ApplicationLoadBalancer,
  CfnListener,
  ApplicationProtocol,
  ApplicationListener,
  ApplicationTargetGroup,
  TargetType,
} from '@aws-cdk/aws-elasticloadbalancingv2';

export interface CacclLoadBalancerProps {
  sg: SecurityGroup;
  vpc: Vpc;
  certificateArn: string;
  loadBalancerTarget: IEcsLoadBalancerTarget;
}

export class CacclLoadBalancer extends Construct {
  loadBalancer: ApplicationLoadBalancer;
  httpsListener: ApplicationListener;

  constructor(scope: Construct, id: string, props: CacclLoadBalancerProps) {
    super(scope, id);

    const { sg, vpc, certificateArn, loadBalancerTarget } = props;

    this.loadBalancer = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      securityGroup: sg,
      internetFacing: true,
    });

    new CfnListener(this, 'HttpRedirect', {
      loadBalancerArn: this.loadBalancer.loadBalancerArn,
      protocol: ApplicationProtocol.HTTP,
      port: 80,
      defaultActions: [
        {
          type: 'redirect',
          redirectConfig: {
            statusCode: 'HTTP_301',
            port: '443',
            protocol: 'HTTPS',
            host: '#{host}',
            path: '/#{path}',
            query: '#{query}',
          },
        },
      ],
    });

    const httpsListener = new ApplicationListener(this, 'HttpsListener', {
      loadBalancer: this.loadBalancer,
      certificates: [{ certificateArn }],
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
    });

    const appTargetGroup = new ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      // setting this duration value enables the lb stickiness; 1 day is the default
      stickinessCookieDuration: Duration.seconds(86400),
      targetType: TargetType.IP,
      targets: [loadBalancerTarget],
    });

    httpsListener.addTargetGroups('AppTargetGroup', {
      targetGroups: [appTargetGroup],
    });

    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
  }
}