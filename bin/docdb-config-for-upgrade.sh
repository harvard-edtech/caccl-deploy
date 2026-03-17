#!/usr/bin/bash

set -eo pipefail

APP_NAME=$1
UPGRADE_STEP=$2

if [[ -z $APP_NAME || -z $UPGRADE_STEP ]]; then
  echo "Usage: $0 <app_name> [pre|orphan|post]"
  echo "Example: $0 myapp pre"
  exit 1
fi

STACK_NAME="CacclDeploy-${APP_NAME}"
clusterEndpoint=$(aws cloudformation list-exports \
  --query "Exports[?Name=='${STACK_NAME}-db-cluster-endpoint'].Value" \
  --output text | awk '{print $1}')

case "$UPGRADE_STEP" in
  pre)
    caccl-deploy update --app "$APP_NAME" dbOptions/clusterEndpointOverride "$clusterEndpoint"
    caccl-deploy update --app "$APP_NAME" dbOptions/removalPolicy RETAIN
    ;;
  orphan)
    caccl-deploy update --app "$APP_NAME" dbOptions/docdbUseVersionSuffix true
    caccl-deploy update --app "$APP_NAME" dbOptions/engineVersion 5.0.0
    caccl-deploy update --app "$APP_NAME" dbOptions/parameterGroupFamily docdb5.0
    caccl-deploy update --app "$APP_NAME" lbOptions/targetDeregistrationDelay 5
    ;;
  post)
    caccl-deploy update --app "$APP_NAME" -D dbOptions/clusterEndpointOverride
    ;;
  cleanup)
    caccl-deploy update --app "$APP_NAME" -D lbOptions/targetDeregistrationDelay
    ;;
  *)
    echo "Error: upgrade step must be one of pre, orphan, post, cleanup" >&2
    exit 1
    ;;
esac
