#!/usr/bin/env bash
# This script connects to a DocumentDB 3.6 cluster using the provided cluster endpoint.
# It uses a 3.6 version of the mongo docker image to get around driver compatibility issues.
# You must establish the ssm or ssl port forwarding tunnel before running this script.

PASSWORD=$1
PEM_FILE=${2:-$HOME/.config/ssl/global-bundle.pem}

docker run --rm -it --network host \
  -v $PEM_FILE:/ca.pem:ro mongo:3.6 \
  mongo --host 127.0.0.1 --port 27018 --ssl --sslCAFile /ca.pem \
  -u root -p $PASSWORD \
  --sslAllowInvalidHostnames --sslAllowInvalidCertificates
