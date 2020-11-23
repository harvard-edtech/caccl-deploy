FROM node:12

ARG package=./caccl-deploy.tgz

RUN DEBIAN_FRONTEND=noninteractive apt -y update \
  && apt -y dist-upgrade \
  && apt -y install awscli

USER node
WORKDIR /home/node

COPY ${package} ${package}

ENV NPM_PACKAGES="/home/node/.npm-packages"
RUN mkdir -p ${NPM_PACKAGES}
RUN npm config set prefix ${NPM_PACKAGES}
RUN npm i -g ${package}
ENV PATH="${PATH}:${NPM_PACKAGES}/bin"
ENV AWS_SDK_LOAD_CONFIG=true

CMD ["/bin/bash"]
