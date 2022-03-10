FROM node:14

ARG package=./caccl-deploy.tgz

RUN DEBIAN_FRONTEND=noninteractive apt -y update \
  && apt -y dist-upgrade \
  && apt -y install awscli vim

RUN npm install -g npm@8

USER node
WORKDIR /home/node

ENV NPM_PACKAGES="/home/node/.npm-packages"
RUN mkdir -p ${NPM_PACKAGES}
RUN npm config set prefix ${NPM_PACKAGES}
ENV PATH="${PATH}:${NPM_PACKAGES}/bin"

COPY ${package} ${package}
RUN npm i -g ${package}

CMD ["/bin/bash"]
