import { Construct } from '@aws-cdk/core';
import {
  ApplicationLoadBalancer,
  CfnListener,
  ApplicationProtocol,
  ApplicationListener,
  ContentType
} from '@aws-cdk/aws-elasticloadbalancingv2';
import { SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';

export interface AlbConstructProps {
  vpc: Vpc,
  securityGroup: SecurityGroup,
  certificateArn: string,
};

export class AlbConstruct extends Construct {
  readonly loadBalancer: ApplicationLoadBalancer;
  readonly httpsListener: ApplicationListener;

  constructor(scope: Construct, id: string, props: AlbConstructProps) {
    super(scope, id);

    this.loadBalancer = new ApplicationLoadBalancer(this,
      'ApplicationLoadBalancer', {
        vpc: props.vpc,
        internetFacing: true,
        securityGroup: props.securityGroup,
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

    this.httpsListener = new ApplicationListener(this,
      'HttpsListener', {
        loadBalancer: this.loadBalancer,
        certificates: [{
          certificateArn: props.certificateArn,
        }],
        port: 443,
        protocol: ApplicationProtocol.HTTPS,
      });

    this.httpsListener.addFixedResponse('HttpsDefaultResponse', {
      statusCode: '200',
      contentType: ContentType.TEXT_PLAIN,
      messageBody: 'Hello!',
    });
  }
};
