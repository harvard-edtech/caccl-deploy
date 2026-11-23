#!/usr/bin/env bash
# Run a stack operation across all (or a subset of) the apps in an AWS account.
#
# Intended for rolling out a change that affects many apps at once, e.g. a new
# caccl-deploy version, a new bastion AMI id, or an updated proxy image.
# The usual sequence is:
#
#   bulk-deploy.sh check       # `stack diff` for each app
#   bulk-deploy.sh changeset   # create (but don't execute) a change set for each app
#   bulk-deploy.sh view        # show the resource changes in each app's change set
#   bulk-deploy.sh deploy      # execute each app's change set
#
# `deploy` starts the change sets and returns; it does not wait for the stack
# updates to finish.
#
# The AWS account and region come from the environment (e.g. AWS_PROFILE).
# App names for --only/--exclude can be shell glob patterns, e.g. 'staffstuff-*'.

set -euo pipefail

SSM_ROOT_PREFIX=/caccl-deploy
CFN_STACK_PREFIX=CacclDeploy-
CHANGESET_NAME=cdk-deploy-change-set

usage() {
  echo "Usage: $0 <check|changeset|view|deploy> [--only app1,app2] [--exclude app1,app2] [--yes]" >&2
}

mode="${1:-}"
only_csv=""
exclude_csv=""
yes=false

if [[ "$mode" == "-h" || "$mode" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$mode" != "check" && "$mode" != "changeset" && "$mode" != "view" && "$mode" != "deploy" ]]; then
  [[ -n "$mode" ]] && echo "Invalid mode: $mode" >&2
  usage
  exit 1
fi

shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only)
      only_csv="${2:-}"
      shift 2
      ;;
    --exclude)
      exclude_csv="${2:-}"
      shift 2
      ;;
    -y|--yes)
      yes=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# true if the app name matches any of the comma-separated names/glob patterns
matches_any() {
  local app="$1" csv="$2" pattern
  local -a patterns
  IFS="," read -r -a patterns <<< "$csv"
  for pattern in "${patterns[@]}"; do
    # shellcheck disable=SC2053 # unquoted on purpose so glob patterns work
    if [[ "$app" == $pattern ]]; then
      return 0
    fi
  done
  return 1
}

# outputs "<change set id> <status>" for the app stack's pending change set
get_changeset() {
  aws cloudformation list-change-sets --stack-name "$1" \
    --query "Summaries[?ChangeSetName=='${CHANGESET_NAME}'].[ChangeSetId,Status] | [0]" --output text
}

# every app configuration is assumed to include an `infraStackName` setting
all_apps=$(aws ssm describe-parameters \
  --parameter-filters Key=Name,Option=Contains,Values=/infraStackName \
  --query 'Parameters[].[Name]' --output text \
  | grep "^${SSM_ROOT_PREFIX}/" | cut -d "/" -f 3 | sort)

apps=()
for a in $all_apps; do
  if [[ -n "$only_csv" ]] && ! matches_any "$a" "$only_csv"; then
    continue
  fi
  if [[ -n "$exclude_csv" ]] && matches_any "$a" "$exclude_csv"; then
    continue
  fi
  apps+=("$a")
done

if [[ ${#apps[@]} -eq 0 ]]; then
  echo "No apps selected" >&2
  exit 1
fi

account=$(aws sts get-caller-identity --query Account --output text)
echo "AWS account ${account}: ${mode} for ${#apps[@]} app(s): ${apps[*]}" >&2

if [[ "$mode" == "deploy" && "$yes" != true ]]; then
  read -r -p "Execute the change sets for these apps? [y/N] " answer || answer=""
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "Aborted" >&2
    exit 1
  fi
fi

for a in "${apps[@]}"; do
  stack_name="${CFN_STACK_PREFIX}${a}"
  case "$mode" in
    check)
      caccl-deploy stack --app "$a" diff -- --require-approval=never
      ;;
    changeset)
      caccl-deploy stack --app "$a" --yes changeset -- --require-approval=never
      ;;
    view)
      read -r changeset_id changeset_status <<< "$(get_changeset "$stack_name")"
      if [[ -z "$changeset_id" || "$changeset_id" == "None" ]]; then
        echo "No change set found for $stack_name" >&2
        continue
      fi
      if [[ "$changeset_status" == "FAILED" ]]; then
        echo "=== $a ($stack_name) [FAILED] ==="
      else
        echo "=== $a ($stack_name) ==="
      fi
      aws cloudformation describe-change-set --stack-name "$stack_name" --change-set-name "$changeset_id" \
        --query "Changes[].ResourceChange.{LogicalResourceId: LogicalResourceId, ResourceType: ResourceType, Replacement: Replacement}" \
        --output table
      ;;
    deploy)
      read -r changeset_id changeset_status <<< "$(get_changeset "$stack_name")"
      if [[ -z "$changeset_id" || "$changeset_id" == "None" ]]; then
        echo "No change set found for $stack_name" >&2
        continue
      fi
      if [[ "$changeset_status" == "FAILED" ]]; then
        echo "Change set for $stack_name is in FAILED state, skipping" >&2
        continue
      fi
      echo "=== $a ($stack_name) ==="
      aws cloudformation execute-change-set --stack-name "$stack_name" --change-set-name "$changeset_id"
      ;;
  esac
done
