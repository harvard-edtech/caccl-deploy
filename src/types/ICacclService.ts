import { aws_cloudwatch as cloudwatch, aws_ecs as ecs } from 'aws-cdk-lib';

/**
 * Interface for a generic CDK service, allowing for alarms, ECS/Fargate, and ELB targets.
 * @author Benedikt Arnarsson
 */
export interface ICacclService {
  alarms: cloudwatch.Alarm[];

  ecsService: ecs.FargateService;

  loadBalancerTarget: ecs.IEcsLoadBalancerTarget;
}
