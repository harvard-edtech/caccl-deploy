#!/bin/bash

# move to this script's directory
pushd "$(dirname $0)"

# create the package from current sources
mv "$(npm pack ../.. | tail -n 1)" package.tgz

# build the docker image
docker build --rm --build-arg "package=package.tgz" -t "hdce/caccl-deploy" .

rm package.tgz

cat << EOF
To use this image with your existing AWS credentials, run:

  docker run -ti --rm -v ${HOME}/.aws:/home/node/.aws:ro hdce/caccl-deploy

If you have mulitple credential profiles with no default indicated:

  docker run -ti --rm -v ${HOME}/.aws:/home/node/.aws:ro -e AWS_PROFILE=[profile] hdce/caccl-deploy

To start fresh with no AWS configuration within the container leave off the `-v` mount

  docker run -ti --rm hdce/caccl-deploy

EOF
