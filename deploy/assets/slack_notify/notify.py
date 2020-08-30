import json
import urllib3
from os import getenv
from operator import itemgetter

url = getenv("SLACK_WEBHOOK_URL")
http = urllib3.PoolManager()

def handler(event, context):

    print(event)
    sns_msg = event['Records'][0]['Sns']['Message']

    try:
        data = json.loads(sns_msg)
        print(data)
        slack_msg = generate_slack_msg(data)
    except json.JSONDecodeError as e:
        # must not be json?
        slack_msg = { "text": sns_msg }

    request_body = json.dumps(slack_msg).encode('utf-8')
    resp = http.request('POST', url, body=request_body)

    print({
        "slack_msg": slack_msg,
        "status_code": resp.status,
        "response": resp.data
    })

def generate_slack_msg(data):
    if "AlarmArn" in data:

        alarm_arn = data["AlarmArn"]
        metric_name = data["Trigger"]["MetricName"]
        old_state = data["OldStateValue"]
        new_state = data["NewStateValue"]

        region, alarm_name = itemgetter(3, 6)(alarm_arn.split(":"))

        alarm_link = f"https://console.aws.amazon.com/cloudwatch/home?region={region}#alarmsV2:alarm/{alarm_name}"

        if new_state == "ALARM":
            message_title = ":rotating_light:  *Cloudwatch Alarm* :rotating_light:"
        else:
            message_title = "*Cloudwatch Alarm Update*"

        return {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "\n".join([
                            message_title,
                            f"<{alarm_link}|{alarm_name}>",
                            f"Metric: *{metric_name}*",
                            f"Previous state: *{old_state}*",
                            f"New state: *{new_state}*"
                        ])
                    }
                }
            ]
        }
