import { aws_cloudwatch as cloudwatch, aws_ecs as ecs } from 'aws-cdk-lib';

interface ICacclService {
  alarms: cloudwatch.Alarm[];

  ecsService: ecs.FargateService;

  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;
}

export default ICacclService;
