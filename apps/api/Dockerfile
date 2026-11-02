FROM node:24-slim

ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# 1. Dependencies: only the files that describe them
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter "api..."

# 2. Source code
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "src/index.ts"]