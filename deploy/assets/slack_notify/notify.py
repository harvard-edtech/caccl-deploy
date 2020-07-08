import json
import urllib3
from os import getenv

url = getenv("SLACK_WEBHOOK_URL")
http = urllib3.PoolManager()

def handler(event, context):
    msg = {
        "text": event['Records'][0]['Sns']['Message'],
    }

    encoded_msg = json.dumps(msg).encode('utf-8')
    resp = http.request('POST', url, body=encoded_msg)
    print({
        "message": event['Records'][0]['Sns']['Message'],
        "status_code": resp.status,
        "response": resp.data
    })
