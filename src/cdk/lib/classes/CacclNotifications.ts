import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import {
  aws_sns as sns,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_cloudwatch_actions as actions,
  aws_sns_subscriptions as subscriptions,
  CfnOutput,
  Stack,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacclNotificationsProps } from '../../../types/index.js';

class CacclNotifications extends Construct {
  topic: sns.Topic;

  subscriptions: sns.Subscription[];

  constructor(scope: Construct, id: string, props: CacclNotificationsProps) {
    super(scope, id);

    const email = typeof props.email === 'string' ? [props.email] : props.email;

    const { slack, service, loadBalancer, db } = props;

    this.topic = new sns.Topic(this, 'NotificationTopic', {
      displayName: `${Stack.of(this).stackName}-notifications`,
    });

    this.topic.grantPublish({
      grantPrincipal: new iam.ServicePrincipal('cloudwatch.amazonaws.com'),
    });

    if (email) {
      email.forEach((emailAddr, idx) => {
        new sns.Subscription(this, `email-subscription-${idx}`, {
          topic: this.topic,
          protocol: sns.SubscriptionProtocol.EMAIL,
          endpoint: emailAddr,
        });
      });
    }

    if (slack !== undefined) {
      const slackFunction = new lambda.Function(this, 'SlackFunction', {
        functionName: `${Stack.of(this).stackName}-slack-notify`,
        runtime: lambda.Runtime.PYTHON_3_8,
        handler: 'notify.handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../assets/slack_notify'),
        ),
        environment: {
          SLACK_WEBHOOK_URL: slack,
        },
      });

      this.topic.addSubscription(
        new subscriptions.LambdaSubscription(slackFunction),
      );
    }

    loadBalancer.alarms.forEach((alarm) => {
      alarm.addAlarmAction(new actions.SnsAction(this.topic));
    });

    service.alarms.forEach((alarm) => {
      alarm.addAlarmAction(new actions.SnsAction(this.topic));
    });

    db?.alarms.forEach((alarm) => {
      alarm.addAlarmAction(new actions.SnsAction(this.topic));
    });

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

export default CacclNotifications;
