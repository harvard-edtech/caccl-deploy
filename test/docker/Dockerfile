FROM node:18

ARG package=./caccl-deploy.tgz

RUN DEBIAN_FRONTEND=noninteractive apt -y update \
  && apt -y dist-upgrade \
  && apt -y install awscli vim

RUN npm install -g npm@9

USER node
WORKDIR /home/node

ENV NPM_PACKAGES="/home/node/.npm-packages"
RUN mkdir -p ${NPM_PACKAGES}
RUN npm config set prefix ${NPM_PACKAGES}
ENV PATH="${PATH}:${NPM_PACKAGES}/bin"

COPY ${package} ${package}
RUN npm i --verbose -g ${package}

CMD ["/bin/bash"]
