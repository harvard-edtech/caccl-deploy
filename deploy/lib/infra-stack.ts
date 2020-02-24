import { Stack, StackProps, Construct } from '@aws-cdk/core';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import { VpcConstruct } from './vpc';
import { ClusterConstruct } from './cluster';
import { AlbConstruct } from './alb';
import { Cluster } from '@aws-cdk/aws-ecs';
import { ApplicationListener } from '@aws-cdk/aws-elasticloadbalancingv2';
import { SsmExportedParamSet, SsmImportedParamSet } from './ssm-param-set';
import { ParameterType } from '@aws-cdk/aws-ssm';

export class CacclInfraStackBase extends Stack {

  vpc: Vpc;
  securityGroup: SecurityGroup;
  cluster: Cluster;
  loadBalancerDns: string;
  httpsListener: ApplicationListener;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  }
}

export interface CacclInfraStackProps extends StackProps {
  readonly cidrBlock: string;
  readonly acmCertificateArn: string;
}

export class CacclInfraStack extends CacclInfraStackBase {

  constructor(scope: Construct, id: string, props: CacclInfraStackProps) {
    super(scope, id, props);

    // network stuff
    const vpcConstruct = new VpcConstruct(this, 'Vpc', {
      cidrBlock: props.cidrBlock,
    });
    this.vpc = vpcConstruct.vpc;
    this.securityGroup = vpcConstruct.securityGroup;

    // the ECS cluster; services and tasks are created by the app(s)
    const clusterConstruct = new ClusterConstruct(this, 'Cluster', {
      vpc: this.vpc,
    });
    this.cluster = clusterConstruct.cluster;

    // application load balancer; the app(s) will attach themselves as
    // "targets" of the https listener
    const albConstruct = new AlbConstruct(this, 'LoadBalancer', {
      vpc: this.vpc,
      certificateArn: props.acmCertificateArn,
      securityGroup: this.securityGroup,
    });
    this.loadBalancerDns = albConstruct.loadBalancer.loadBalancerDnsName;
    this.httpsListener = albConstruct.httpsListener;
  }
}

export interface CacclSharedInfraStackProps extends StackProps {
  readonly infraStackName: string;
}

export class CacclSharedInfraStack extends CacclInfraStackBase {
  constructor(scope: Construct, id: string, props: CacclSharedInfraStackProps) {
    super(scope, id, props);

    const importedParams = new SsmImportedParamSet(this, 'ImportedParams', {
      paramPrefix: `${ Stack.of(this).stackName }`,
      paramNames: [
        'VpcId',
        'SecurityGroupId',
        'ClusterName',
        'HttpsListenerArn',
      ],
    });

    const importedValues = importedParams.paramValues;

    this.vpc = <Vpc>Vpc.fromLookup(this, 'ImportedVpc', {
      vpcId: importedValues.VpcId,
    });

    this.securityGroup = <SecurityGroup>SecurityGroup
      .fromSecurityGroupId(
        this,
        'ImportedSecurityGroup',
        importedValues.SecurityGroupId,
      );

    // The existing ECS cluster
    this.cluster = <Cluster>Cluster.fromClusterAttributes(this,
      'ImportedCluster', {
        clusterName: importedValues.ClusterName,
        vpc: this.vpc,
        securityGroups: [this.securityGroup],
      }
    );

    this.httpsListener = <ApplicationListener>ApplicationListener
      .fromApplicationListenerAttributes(
        this,
        'ImportedHttpsListener', {
          listenerArn: importedValues.HttpsListenerArn,
          securityGroup: this.securityGroup,
        }
      );

    this.loadBalancerDns = this.httpsListener.loadBalancer.loadBalancerDnsName;
  }
}
