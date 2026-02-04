#!/usr/bin/env bash
# This script displays the current value of specific configuration setting for all apps

ENTRY_NAME=$1
# Allow dot notation (dbOptions.parameterGroupFamily) or slash paths (dbOptions/parameterGroupFamily).
ENTRY_PATH=${ENTRY_NAME//./\/}
NAMESPACE=caccl-deploy

aws ssm get-parameters-by-path \
  --path /${NAMESPACE} \
  --recursive \
  --with-decryption \
  --output json \
| jq -r --arg entry_name "$ENTRY_PATH" '
  def app_of($p): ($p.Name | split("/"))[2];
  def is_child($p): $p.Name | test("/" + $entry_name + "/");
  def is_leaf($p): $p.Name | endswith("/" + $entry_name);

  .Parameters as $params
  | ($params | map(app_of(.)) | unique | sort) as $apps
  | $apps[] as $app
  | ($params | map(select(app_of(.) == $app))) as $app_params
  | ($app_params | map(select(is_child(.))) | sort_by(.Name)) as $children
  | if ($children | length) > 0 then
      [ $app, ($children | map(.Value) | join("|")) ]
    else
      ($app_params | map(select(is_leaf(.))) | .[0]?) as $leaf
      | if $leaf then
          [ $app, ($leaf.Value | split(":")[-1]) ]
        else
          [ $app, "" ]
        end
    end
  | @tsv
' | column -t
