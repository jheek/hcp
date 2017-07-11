FROM node:8

EXPOSE 8080
WORKDIR /app
VOLUME /tmp /data

COPY package.json tsconfig.json webpack.config.js ./
RUN yarn global add webpack && yarn

COPY tree-tagger /tree-tagger/

COPY src/ ./src/
RUN webpack

COPY public/ ./public
COPY server.js ./
CMD ["node", "server.js"]