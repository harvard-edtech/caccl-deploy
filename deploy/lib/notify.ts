import * as path from 'path';
import { Rule, EventPattern } from '@aws-cdk/aws-events';
import { SnsTopic, SnsTopicProps } from '@aws-cdk/aws-events-targets';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Topic, Subscription, SubscriptionProtocol } from '@aws-cdk/aws-sns';
import { LambdaSubscription } from '@aws-cdk/aws-sns-subscriptions';
import { Construct, CfnOutput, Stack } from '@aws-cdk/core';

export interface CacclNotificationsProps {
  email?: [string];
  slack?: string;
}

export class CacclNotifications extends Construct {
  topic: Topic;

  subscriptions: Subscription[];

  constructor(scope: Construct, id: string, props: CacclNotificationsProps) {
    super(scope, id);

    const { email = [], slack } = props;

    this.topic = new Topic(this, 'NotificationTopic', {
      displayName: `${Stack.of(this).stackName}-notifications`,
    });

    email.forEach((emailAddr, idx) => {
      new Subscription(this, `email-subscription-${idx}`, {
        topic: this.topic,
        protocol: SubscriptionProtocol.EMAIL,
        endpoint: emailAddr,
      });
    });

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

    new CfnOutput(this, 'TopicName', {
      exportName: `${Stack.of(this).stackName}-sns-topic-name`,
      value: this.topic.topicName,
    });

    new CfnOutput(this, 'TopicArn', {
      exportName: `${Stack.of(this).stackName}-sns-topic-arn`,
      value: this.topic.topicArn,
    });
  }

  addNotificationRule(ruleName: string, eventPattern: EventPattern, message?: SnsTopicProps): Rule {
    const target = new SnsTopic(this.topic, message);
    return new Rule(this, ruleName, {
      enabled: true,
      ruleName,
      eventPattern,
      targets: [target],
    });
  }
}
