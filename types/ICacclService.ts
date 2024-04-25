import { aws_cloudwatch as cloudwatch, aws_ecs as ecs } from 'aws-cdk-lib';

interface ICacclService {
  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;

  ecsService: ecs.FargateService;

  alarms: cloudwatch.Alarm[];
}

export default ICacclService;
