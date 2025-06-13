import {
  CfnOutput,
  Stack,
  aws_cloudwatch_actions as actions,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_sns as sns,
  aws_sns_subscriptions as subscriptions,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CacclNotificationsProps } from '../../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CacclNotifications extends Construct {
  subscriptions: sns.Subscription[];

  topic: sns.Topic;

  constructor(scope: Construct, id: string, props: CacclNotificationsProps) {
    super(scope, id);

    const email = typeof props.email === 'string' ? [props.email] : props.email;

    const { db, loadBalancer, service, slack } = props;

    this.topic = new sns.Topic(this, 'NotificationTopic', {
      displayName: `${Stack.of(this).stackName}-notifications`,
    });

    this.topic.grantPublish({
      grantPrincipal: new iam.ServicePrincipal('cloudwatch.amazonaws.com'),
    });

    if (email) {
      for (const [idx, emailAddr] of email.entries()) {
        new sns.Subscription(this, `email-subscription-${idx}`, {
          endpoint: emailAddr,
          protocol: sns.SubscriptionProtocol.EMAIL,
          topic: this.topic,
        });
      }
    }

    if (slack !== undefined) {
      const slackFunction = new lambda.Function(this, 'SlackFunction', {
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../assets/slack_notify'),
        ),
        environment: {
          SLACK_WEBHOOK_URL: slack,
        },
        functionName: `${Stack.of(this).stackName}-slack-notify`,
        handler: 'notify.handler',
        runtime: lambda.Runtime.PYTHON_3_8,
      });

      this.topic.addSubscription(
        new subscriptions.LambdaSubscription(slackFunction),
      );
    }

    for (const alarm of loadBalancer.alarms) {
      alarm.addAlarmAction(new actions.SnsAction(this.topic));
    }

    for (const alarm of service.alarms) {
      alarm.addAlarmAction(new actions.SnsAction(this.topic));
    }

    if (db) {
      for (const alarm of db.alarms) {
        alarm.addAlarmAction(new actions.SnsAction(this.topic));
      }
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
}

export default CacclNotifications;
