FROM node:22-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY shared ./shared
COPY services/api ./services/api

RUN pnpm install --frozen-lockfile --filter api...
RUN pnpm --filter api build

WORKDIR /app/services/api

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]

