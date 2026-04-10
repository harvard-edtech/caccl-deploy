#!/usr/bin/env bash
# This script connects to a DocumentDB 3.6 cluster using the provided cluster endpoint.
# It uses a 3.6 version of the mongo docker image to get around driver compatibility issues.
# This script establishes an SSM port-forwarding session before connecting.

set -euo pipefail

APP_NAME=""
PEM_FILE="$HOME/.config/ssl/global-bundle.pem"
LOCAL_PORT=27017
SSM_PID=""

function usage {
  echo "usage: $(basename "$0") app_name [db_endpoint:port]"
  exit 1
}

APP_NAME=${1:-}
DB_ENDPOINT_OVERRIDE=${2:-}

if [[ -z $APP_NAME ]]; then
  usage
fi

if [[ ! -f $PEM_FILE ]]; then
  echo "Error: CA bundle not found at $PEM_FILE" >&2
  echo "Download the DocumentDB CA bundle to that path and retry." >&2
  exit 1
fi

STACK_NAME="CacclDeploy-${APP_NAME}"
SECRET_ARN=$(aws cloudformation list-exports \
  --query "Exports[?Name=='${STACK_NAME}-db-password-secret-arn'].Value" \
  --output text)

if [[ -z $SECRET_ARN || $SECRET_ARN == "None" ]]; then
  echo "Error: could not find password secret export for ${STACK_NAME}" >&2
  exit 1
fi

PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --query 'SecretString' --output text)

BASTION_INSTANCE_ID=$(aws cloudformation list-exports \
  --query "Exports[?Name=='${STACK_NAME}-bastion-host-id'].Value" \
  --output text)

if [[ -z $BASTION_INSTANCE_ID || $BASTION_INSTANCE_ID == "None" ]]; then
  echo "Error: could not find bastion host export for ${STACK_NAME}" >&2
  exit 1
fi

if [[ -n $DB_ENDPOINT_OVERRIDE ]]; then
  DB_ENDPOINT_WITH_PORT=$DB_ENDPOINT_OVERRIDE
else
  DB_ENDPOINT_WITH_PORT=$(aws cloudformation list-exports \
    --query "Exports[?Name=='${STACK_NAME}-db-cluster-endpoint'].Value" \
    --output text)
fi

if [[ -z $DB_ENDPOINT_WITH_PORT || $DB_ENDPOINT_WITH_PORT == "None" ]]; then
  echo "Error: could not find db endpoint export for ${STACK_NAME}" >&2
  exit 1
fi

DB_HOST=${DB_ENDPOINT_WITH_PORT%%:*}
DB_PORT=${DB_ENDPOINT_WITH_PORT##*:}

SSM_CMD=(aws ssm start-session \
  --target "$BASTION_INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=$DB_HOST,portNumber=$DB_PORT,localPortNumber=$LOCAL_PORT")

echo "Starting SSM port-forwarding session..."
echo "Command: ${SSM_CMD[*]}"

# Start SSM session and capture PID properly
"${SSM_CMD[@]}" &
SSM_PID=$!

# Check if the process is actually running
if ! kill -0 "$SSM_PID" 2>/dev/null; then
  echo "Error: failed to start SSM port-forwarding session" >&2
  echo "The SSM session process failed to start or exited immediately" >&2
  echo "Check that:" >&2
  echo "  - You have AWS CLI configured with appropriate credentials" >&2
  echo "  - The bastion host ($BASTION_INSTANCE_ID) exists and is running" >&2
  echo "  - You have SSM permissions for the bastion host" >&2
  echo "  - The Session Manager plugin is installed" >&2
  exit 1
fi

trap '[ -n "${SSM_PID:-}" ] && kill "$SSM_PID" >/dev/null 2>&1 || true' EXIT

echo "SSM session started (PID: $SSM_PID), waiting for connection to establish..."
sleep 5

# Test if port forwarding is working
if ! nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null; then
  echo "Warning: Port $LOCAL_PORT doesn't appear to be listening yet" >&2
  echo "Waiting a bit longer..." >&2
  sleep 5
  if ! nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null; then
    echo "Error: Port forwarding may not be working properly" >&2
    echo "Proceeding anyway, but connection may fail..." >&2
  fi
fi

docker run --rm -it --network host \
  -v $PEM_FILE:/ca.pem:ro mongo:3.6 \
  mongo --host 127.0.0.1 --port $LOCAL_PORT --ssl --sslCAFile /ca.pem \
  -u root -p $PASSWORD \
  --sslAllowInvalidHostnames --sslAllowInvalidCertificates
