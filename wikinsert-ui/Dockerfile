FROM node:14-alpine3.12 AS BUILD_IMAGE
ARG BUILD_ID
LABEL build=$BUILD_ID

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile

COPY . .

RUN yarn build

FROM node:14-alpine3.12

WORKDIR /app

RUN yarn add express

COPY serve.js .
COPY --from=BUILD_IMAGE /app/build ./build

CMD ["node", "serve.js"]
