FROM node:18-alpine
LABEL maintainer="moneytrackr"

WORKDIR /home/app

COPY package.json yarn.lock ./
RUN yarn install --production && yarn cache clean

COPY . .

EXPOSE 80
CMD ["yarn", "start"]
