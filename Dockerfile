FROM strapi/base

WORKDIR backend-api

COPY ./backend-api/package.json ./
COPY ./backend-api/yarn.lock ./

RUN yarn install

COPY . .

ENV NODE_ENV production

RUN yarn build

EXPOSE 1337

CMD ["yarn", "start"]