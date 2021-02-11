#!/bin/bash

profile=$1
user=$2
export AWS_DEFAULT_OUTPUT=text

groups=$(aws --profile $profile iam list-groups-for-user --user-name $2 --query 'Groups[].GroupName')

aws --profile $profile iam list-user-policies --user-name $user --query 'PolicyNames[].[@]'
aws --profile $profile iam list-attached-user-policies --user-name $user --query 'AttachedPolicies[].[PolicyName]'

for g in $groups; do
  aws --profile $profile iam list-group-policies --group-name $g --query 'PolicyNames[].[@]'
  aws --profile $profile iam list-attached-group-policies --group-name $g --query 'AttachedPolicies[].[PolicyName]'
done
