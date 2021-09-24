import * as path from 'path';
import { SnsAction } from '@aws-cdk/aws-cloudwatch-actions';
import { ServicePrincipal } from '@aws-cdk/aws-iam';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Topic, Subscription, SubscriptionProtocol } from '@aws-cdk/aws-sns';
import { LambdaSubscription } from '@aws-cdk/aws-sns-subscriptions';
import { Construct, CfnOutput, Stack } from '@aws-cdk/core';
import { CacclDocDb, CacclRdsDb } from './db';
import { CacclLoadBalancer } from './lb';
import { CacclService } from './service';

export interface CacclNotificationsProps {
  email?: (string | string[]);
  slack?: string;
  service: CacclService;
  loadBalancer: CacclLoadBalancer;
  db?: CacclDocDb | CacclRdsDb;
}

export class CacclNotifications extends Construct {
  topic: Topic;

  subscriptions: Subscription[];

  constructor(scope: Construct, id: string, props: CacclNotificationsProps) {
    super(scope, id);

    const email = (
      typeof props.email === 'string'
        ? [props.email]
        : props.email
    );

    const { slack, service, loadBalancer, db } = props;

    this.topic = new Topic(this, 'NotificationTopic', {
      displayName: `${Stack.of(this).stackName}-notifications`,
    });

    this.topic.grantPublish({
      grantPrincipal: new ServicePrincipal('cloudwatch.amazonaws.com'),
    });

    if (email) {
      email.forEach((emailAddr, idx) => {
        new Subscription(this, `email-subscription-${idx}`, {
          topic: this.topic,
          protocol: SubscriptionProtocol.EMAIL,
          endpoint: emailAddr,
        });
      });
    }

    if (slack !== undefined) {
      const slackFunction = new Function(this, 'SlackFunction', {
        functionName: `${Stack.of(this).stackName}-slack-notify`,
        runtime: Runtime.PYTHON_3_8,
        handler: 'notify.handler',
        code: Code.fromAsset(path.join(__dirname, '..', 'assets/slack_notify')),
        environment: {
          SLACK_WEBHOOK_URL: slack,
        },
      });

      this.topic.addSubscription(new LambdaSubscription(slackFunction));
    }

    loadBalancer.alarms.forEach((alarm) => {
      alarm.addAlarmAction(new SnsAction(this.topic));
    });

    service.alarms.forEach((alarm) => {
      alarm.addAlarmAction(new SnsAction(this.topic));
    });

    db?.alarms.forEach((alarm) => {
      alarm.addAlarmAction(new SnsAction(this.topic));
    })

    new CfnOutput(this, 'TopicName', {
      exportName: `${Stack.of(this).stackName}-sns-topic-name`,
      value: this.topic.topicName,
    });

    new CfnOutput(this, 'TopicArn', {
      exportName: `${Stack.of(this).stackName}-sns-topic-arn`,
      value: this.topic.topicArn,
    });
  }
}
