FROM node:16.14.0-bullseye

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN set -eux; \
    npm install;

ENTRYPOINT ["npm", "run"]
CMD ["start"]
