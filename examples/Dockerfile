FROM node:10-alpine

# set this up top; it will persist into the container
# environment *and* prevent dev dependencies from installing
ENV NODE_ENV production

# copy the app code into the /app path
COPY ./ /app
WORKDIR /app

# install dependencies
RUN npm install

# run the build
RUN npm run build

EXPOSE 8080
ENV PORT 8080
CMD ["npm", "start"]
