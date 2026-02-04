#!/usr/bin/env bash

set -euo pipefail

SCRIPT=$(basename "$0")
APP_NAME=""
DB_NAME=""
REGION="us-east-1"
STACK_NAME=""

function usage {
  echo "usage: $SCRIPT --app APP_NAME --db-name DB_NAME"
  echo ""
  echo "Required:"
  echo "  --app   App name for CacclDeploy stack"
  echo "  --db-name    Database name (e.g. hello-store)"
  echo "  -h, --help       Show this help"
  exit 1
}

while (( "$#" )); do
  case "$1" in
    --app)
      APP_NAME=$2
      shift 2
      ;;
    --db-name)
      DB_NAME=$2
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    -*|--*=)
      echo "Error: Unsupported flag $1" >&2
      usage
      ;;
    *)
      echo "Error: Unexpected argument $1" >&2
      usage
      ;;
  esac
done

if [[ -z $APP_NAME || -z $DB_NAME ]]; then
  usage
fi

AWS_ARGS=(--region "$REGION")

function aws_cmd {
  aws "${AWS_ARGS[@]}" "$@"
}

function export_value {
  local export_name=$1
  local value
  value=$(aws_cmd cloudformation list-exports \
    --query "Exports[?Name=='${export_name}'].Value" \
    --output text | awk '{print $1}')
  if [[ -z $value || $value == "None" || $value == "none" ]]; then
    echo "";
    return
  fi
  echo "$value"
}

function endpoint_exists {
  local endpoint_id=$1
  local arn
  arn=$(aws_cmd dms describe-endpoints \
    --filters Name=endpoint-id,Values="$endpoint_id" \
    --query 'Endpoints[0].EndpointArn' \
    --output text 2>/dev/null || true)
  [[ $arn == arn:* ]]
}

STACK_NAME="CacclDeploy-${APP_NAME}"

echo "Stack: $STACK_NAME"
BLUE_ENDPOINT_WITH_PORT=$(export_value "${STACK_NAME}-db-cluster-endpoint-override")
if [[ -z $BLUE_ENDPOINT_WITH_PORT ]]; then
  echo "Error: Missing export ${STACK_NAME}-db-cluster-endpoint-override" >&2
  exit 1
fi

echo "Blue endpoint: $BLUE_ENDPOINT_WITH_PORT"

SOURCE_HOST=${BLUE_ENDPOINT_WITH_PORT%%:*}
SOURCE_PORT=${BLUE_ENDPOINT_WITH_PORT##*:}

# Get cluster info from CloudFormation exports
BLUE_PASSWORD_SECRET_ARN=$(export_value "${STACK_NAME}-db-password-secret-arn")
if [[ -z $BLUE_PASSWORD_SECRET_ARN ]]; then
  echo "Error: Missing export ${STACK_NAME}-db-password-secret-arn" >&2
  exit 1
fi

BLUE_PASSWORD=$(aws_cmd secretsmanager get-secret-value \
  --secret-id "$BLUE_PASSWORD_SECRET_ARN" \
  --query 'SecretString' --output text)

GREEN_PASSWORD_SECRET_ARN=$(export_value "${STACK_NAME}-db-password-secret-arn")
if [[ -z $GREEN_PASSWORD_SECRET_ARN ]]; then
  echo "Error: Missing export ${STACK_NAME}-db-password-secret-arn" >&2
  echo "Make sure the stack is deployed: $STACK_NAME" >&2
  exit 1
fi

GREEN_PASSWORD=$(aws_cmd secretsmanager get-secret-value \
  --secret-id "$GREEN_PASSWORD_SECRET_ARN" \
  --query 'SecretString' --output text)

GREEN_ENDPOINT_WITH_PORT=$(export_value "${STACK_NAME}-db-cluster-endpoint")
if [[ -z $GREEN_ENDPOINT_WITH_PORT ]]; then
  echo "Error: Missing export ${STACK_NAME}-db-cluster-endpoint" >&2
  exit 1
fi

GREEN_HOST=${GREEN_ENDPOINT_WITH_PORT%%:*}
GREEN_PORT=${GREEN_ENDPOINT_WITH_PORT##*:}

CERT_ARN=$(aws_cmd dms describe-certificates \
  --query "Certificates[?CertificateIdentifier=='global-bundle' || CertificateIdentifier=='rds-combined-ca-bundle'].CertificateArn | [0]" \
  --output text)

if [[ -z $CERT_ARN || $CERT_ARN == "None" ]]; then
  if [[ $(aws_cmd dms describe-certificates --query 'length(Certificates)' --output text) -eq 1 ]]; then
    CERT_ARN=$(aws_cmd dms describe-certificates --query 'Certificates[0].CertificateArn' --output text)
  fi
fi

if [[ -z $CERT_ARN || $CERT_ARN == "None" ]]; then
  echo "Error: Could not find a DMS certificate ARN. Create/import the global CA bundle and retry." >&2
  exit 1
fi

BLUE_ENDPOINT_ID="${APP_NAME}-docdb-blue"
GREEN_ENDPOINT_ID="${APP_NAME}-docdb-green"

if endpoint_exists "$BLUE_ENDPOINT_ID"; then
  echo "Error: Blue endpoint already exists: ${BLUE_ENDPOINT_ID}" >&2
  exit 1
fi

if endpoint_exists "$GREEN_ENDPOINT_ID"; then
  echo "Error: Green endpoint already exists: ${GREEN_ENDPOINT_ID}" >&2
  exit 1
fi

DOCDB_SETTINGS_ARGS=()
if aws_cmd dms create-endpoint help 2>/dev/null | grep -q -- '--docdb-settings'; then
  DOCDB_SETTINGS_ARGS=(
    --docdb-settings
    "ServerName=$SOURCE_HOST,Port=$SOURCE_PORT,DatabaseName=$DB_NAME,Username=root,Password=$BLUE_PASSWORD,NestingLevel=none,ExtractDocId=false"
  )
else
  echo "Warning: AWS CLI does not support --docdb-settings; creating endpoints without it." >&2
fi

aws_cmd dms create-endpoint \
  --endpoint-identifier "$BLUE_ENDPOINT_ID" \
  --endpoint-type source \
  --engine-name docdb \
  --username root \
  --password "$BLUE_PASSWORD" \
  --server-name "$SOURCE_HOST" \
  --port "$SOURCE_PORT" \
  --database-name "$DB_NAME" \
  --ssl-mode verify-full \
  --certificate-arn "$CERT_ARN" \
  "${DOCDB_SETTINGS_ARGS[@]}" \
  --tags Key=BlueApp,Value="$APP_NAME" Key=EndpointType,Value=Source Key=Database,Value="$DB_NAME"

DOCDB_SETTINGS_ARGS=()
if aws_cmd dms create-endpoint help 2>/dev/null | grep -q -- '--docdb-settings'; then
  DOCDB_SETTINGS_ARGS=(
    --docdb-settings
    "ServerName=$GREEN_HOST,Port=$GREEN_PORT,DatabaseName=$DB_NAME,Username=root,Password=$GREEN_PASSWORD"
  )
fi

aws_cmd dms create-endpoint \
  --endpoint-identifier "$GREEN_ENDPOINT_ID" \
  --endpoint-type target \
  --engine-name docdb \
  --username root \
  --password "$GREEN_PASSWORD" \
  --server-name "$GREEN_HOST" \
  --port "$GREEN_PORT" \
  --database-name "$DB_NAME" \
  --ssl-mode verify-full \
  --certificate-arn "$CERT_ARN" \
  "${DOCDB_SETTINGS_ARGS[@]}" \
  --tags Key=BlueApp,Value="$APP_NAME" Key=EndpointType,Value=Target Key=Database,Value="$DB_NAME"

echo "Created blue endpoint: $BLUE_ENDPOINT_ID"
echo "Created green endpoint: $GREEN_ENDPOINT_ID"
