FROM node:8-jessie

RUN mkdir -p /src
WORKDIR /src

RUN npm install -g npm@6.11.3

COPY package.json package-lock.json /src/
RUN npm ci

COPY . /src/

CMD node index.js
