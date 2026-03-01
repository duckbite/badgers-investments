FROM node:22-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY shared ./shared
COPY workers/worker ./workers/worker

RUN pnpm install --frozen-lockfile --filter worker...
RUN pnpm --filter worker build

WORKDIR /app/workers/worker

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

