#!/usr/bin/env bash

set -e

SCRIPT=$0
APP_NAME=''
LOCAL_PORT=27017
TUNNEL_ONLY=0
TUNNEL_KEEPALIVE_DEFAULT=10
MONGO_VERSION=$(mongo --quiet --eval 'db.version()')

function usage {
    echo "usage: $SCRIPT [-th] [-k seconds] [-p port] app_name"
    echo "  -h    show this usage info"
    echo "  -t    create the ssh tunnel but don't start a client session"
    echo "  -k    keep the new, unused ssh tunnel open for this many seconds"
    echo "  -p    local_port bind the tunnel to this local port"
    echo "        default is 27017; use this if you already have mongo running locally"
    echo "  app_name"
    echo "        this must match the 'appName' value in your deployConfig.js"
    exit 1
}

POS_PARAMS=( )

while (( "$#" )); do
    case "$1" in
        -h|--help)
            usage
            shift
        ;;
        -t|--tunnel-only)
            TUNNEL_ONLY=1
            # set a longer tunnel timeout if it hasn't been set via cmdline option
            if [[ -z $TUNNEL_KEEPALIVE ]]; then
                TUNNEL_KEEPALIVE=7200
            fi
            shift
        ;;
        -k|--tunnel-keepalive)
            if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
                TUNNEL_KEEPALIVE=$2
                shift 2
            else
                echo "Error: Argument for $1 is missing" >&2
                usage
            fi
        ;;
        -p|--local-port)
            if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
                LOCAL_PORT=$2
                shift 2
            else
                echo "Error: Argument for $1 is missing" >&2
                usage
            fi
        ;;
        -*|--*=) # unsupported flags
            echo "Error: Unsupported flag $1" >&2
            usage
        ;;
        *) # preserve positional arguments
            POS_PARAMS+=( "$1" )
            shift
        ;;
    esac
done

# set positional arguments in their proper place
set -- "${POS_PARAMS[@]}"

APP_NAME=$1

if [[ -z $APP_NAME ]]; then
    usage
fi

STACK_NAME=CacclDeploy-${APP_NAME}

# allow for alternate stack names
BASTION_INSTANCE_ID=`aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[].Outputs[?ExportName=='${STACK_NAME}-docdb-bastion-host-id'].OutputValue" --output text`

# arn of the secretsmanager secret where the db master password is stored
DB_PASSWORD_SECRET_ARN=`aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[].Outputs[?ExportName=='${STACK_NAME}-docdb-password-secret-arn'].OutputValue" --output text`

# endpoint/hostname of the db
DB_ENDPOINT=`aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[].Outputs[?ExportName=='${STACK_NAME}-docdb-cluster-endpoint'].OutputValue" --output text`

# fetch the db password from secretsmanager
DB_PASSWORD=`aws secretsmanager get-secret-value --secret-id $DB_PASSWORD_SECRET_ARN --query 'SecretString' --output text`

version_four="4.0.0"
if [ "$(printf '%s\n' "$version_four" "$MONGO_VERSION" | sort -V | head -n1)" = "$version_four" ]; then
    echo "Using mongo > v4"
    MONGO_OPTIONS="--tls --tlsAllowInvalidHostnames --tlsAllowInvalidCertificates --retryWrites=false"
else
    MONGO_OPTIONS="--ssl --sslAllowInvalidHostnames --sslAllowInvalidCertificates --retryWrites=false"
fi

# we need the bastion host's availability zone and public ip to copy our key there and set up the ssh tunnel
aws ec2 describe-instances --instance-ids $BASTION_INSTANCE_ID --query 'Reservations[].Instances[].[PublicIpAddress,Placement.AvailabilityZone]' --output text | while read ip az
do
    # this puts our ssh public key on the bastion (but only for 60s!)
    aws ec2-instance-connect send-ssh-public-key --instance-id $BASTION_INSTANCE_ID \
    --instance-os-user ec2-user --availability-zone $az \
    --ssh-public-key file://${HOME}/.ssh/id_rsa.pub  >/dev/null
    # create the tunnel; the `sleep 10` makes it so the process autocloses after not being in use
    ssh -C -o StrictHostKeyChecking=no -f -L $LOCAL_PORT:$DB_ENDPOINT ec2-user@$ip \
    sleep ${TUNNEL_KEEPALIVE:-$TUNNEL_KEEPALIVE_DEFAULT}
done

if [[ $TUNNEL_ONLY = 0 ]]; then
    mongo $MONGO_OPTIONS --username root --password $DB_PASSWORD --port $LOCAL_PORT
fi
