#!/usr/bin/env bash
# This script displays the current value of specific configuration setting for all apps

ENTRY_NAME=$1
NAMESPACE=${2:-caccl-deploy}

aws ssm get-parameters-by-path \
  --path /${NAMESPACE} \
  --recursive \
  --with-decryption \
  --output json \
| jq -r --arg entry_name "$ENTRY_NAME" '
  [.Parameters[]
   | select(.Name | endswith("/" + $entry_name))
   | {app:(.Name|split("/")[2]), val:.Value, version:(.Value|split(":")[-1])}]
  | sort_by(.app)[]
  | [.app, .version]
  | @tsv
' | column -t
