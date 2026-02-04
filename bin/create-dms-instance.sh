#!/usr/bin/env bash

set -euo pipefail

SCRIPT=$(basename "$0")
INFRA_STACK=""
REGION="us-east-1"
INSTANCE_CLASS="dms.t3.small"
ALLOCATED_STORAGE=20

function usage {
  echo "usage: $SCRIPT --infra-stack STACK_NAME [OPTIONS]"
  echo ""
  echo "Required:"
  echo "  --infra-stack  CloudFormation stack name with VpcId export"
  echo ""
  echo "Optional:"
  echo "  --instance-class     DMS instance class (default: dms.t3.small)"
  echo "  -h, --help          Show this help"
  exit 1
}

while (( "$#" )); do
  case "$1" in
    --infra-stack)
      INFRA_STACK=$2
      shift 2
      ;;
    --instance-class)
      INSTANCE_CLASS=$2
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

if [[ -z $INFRA_STACK ]]; then
  usage
fi

AWS_ARGS=(--region "$REGION")

function aws_cmd {
  aws "${AWS_ARGS[@]}" "$@"
}

function stack_output_value {
  local output_name=$1
  aws_cmd cloudformation describe-stacks \
    --stack-name "$INFRA_STACK" \
    --query "Stacks[0].Outputs[?ExportName=='${output_name}' || OutputKey=='${output_name}'].OutputValue | [0]" \
    --output text
}

VPC_ID=$(stack_output_value "VpcId")
if [[ -z $VPC_ID ]]; then
  echo "Error: Missing VpcId output/export in stack: $INFRA_STACK" >&2
  exit 1
fi

REPLICATION_INSTANCE_ID="${INFRA_STACK}-dms-instance"

echo "Infra stack: $INFRA_STACK"
echo "VPC ID: $VPC_ID"
echo "DMS Instance ID: $REPLICATION_INSTANCE_ID"

# Check if instance already exists
EXISTING_INSTANCE=$(aws_cmd dms describe-replication-instances \
  --filters Name=replication-instance-id,Values="$REPLICATION_INSTANCE_ID" \
  --query 'ReplicationInstances[0].ReplicationInstanceArn' \
  --output text 2>/dev/null || echo "None")

if [[ $EXISTING_INSTANCE != "None" && -n $EXISTING_INSTANCE ]]; then
  echo "Error: DMS replication instance already exists: ${REPLICATION_INSTANCE_ID}" >&2
  exit 1
fi

# Get VPC subnets
PRIVATE_SUBNETS=$(aws_cmd ec2 describe-subnets \
  --filters Name=vpc-id,Values="$VPC_ID" Name=tag:Name,Values="*Private*" \
  --query 'Subnets[].SubnetId' --output text)

if [[ -z $PRIVATE_SUBNETS ]]; then
  echo "Warning: No subnets with 'Private' in name found, using all subnets in VPC" >&2
  PRIVATE_SUBNETS=$(aws_cmd ec2 describe-subnets \
    --filters Name=vpc-id,Values="$VPC_ID" \
    --query 'Subnets[].SubnetId' --output text)
fi

if [[ -z $PRIVATE_SUBNETS ]]; then
  echo "Error: No subnets found in VPC: $VPC_ID" >&2
  exit 1
fi

# Convert space-separated subnet IDs to array
read -ra SUBNET_ARRAY <<< "$PRIVATE_SUBNETS"

# Get or create replication subnet group
SUBNET_GROUP_ID="${INFRA_STACK}-dms-subnet-group"
EXISTING_SUBNET_GROUP=$(aws_cmd dms describe-replication-subnet-groups \
  --filters Name=replication-subnet-group-id,Values="$SUBNET_GROUP_ID" \
  --query 'ReplicationSubnetGroups[0].ReplicationSubnetGroupIdentifier' \
  --output text 2>/dev/null || echo "None")

if [[ $EXISTING_SUBNET_GROUP == "None" || -z $EXISTING_SUBNET_GROUP ]]; then
  echo "Creating DMS subnet group: $SUBNET_GROUP_ID"
  aws_cmd dms create-replication-subnet-group \
    --replication-subnet-group-identifier "$SUBNET_GROUP_ID" \
    --replication-subnet-group-description "DMS subnet group for ${INFRA_STACK}" \
    --subnet-ids "${SUBNET_ARRAY[@]}"
else
  echo "Using existing DMS subnet group: $SUBNET_GROUP_ID"
fi

# Get default security group for the VPC
SECURITY_GROUP_ID=$(aws_cmd ec2 describe-security-groups \
  --filters Name=vpc-id,Values="$VPC_ID" Name=group-name,Values="default" \
  --query 'SecurityGroups[0].GroupId' --output text)

if [[ -z $SECURITY_GROUP_ID || $SECURITY_GROUP_ID == "None" ]]; then
  echo "Error: Could not find default security group for VPC: $VPC_ID" >&2
  exit 1
fi

echo "VPC: $VPC_ID"
echo "Subnets: ${SUBNET_ARRAY[*]}"
echo "Security Group: $SECURITY_GROUP_ID"
echo "Instance Class: $INSTANCE_CLASS"
echo "Storage: ${ALLOCATED_STORAGE}GB"

# Create DMS replication instance
echo "Creating DMS replication instance..."
aws_cmd dms create-replication-instance \
  --replication-instance-identifier "$REPLICATION_INSTANCE_ID" \
  --replication-instance-class "$INSTANCE_CLASS" \
  --allocated-storage "$ALLOCATED_STORAGE" \
  --replication-subnet-group-identifier "$SUBNET_GROUP_ID" \
  --vpc-security-group-ids "$SECURITY_GROUP_ID" \
  --no-publicly-accessible \
  --no-multi-az

echo "DMS replication instance creation initiated: $REPLICATION_INSTANCE_ID"
echo "Use 'aws dms describe-replication-instances' to check status"
