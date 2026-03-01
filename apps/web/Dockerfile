FROM node:22-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY shared ./shared
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile --filter web...
RUN pnpm --filter web build

WORKDIR /app/apps/web

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "build"]

