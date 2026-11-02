# Stage 1: build the static files
FROM node:24-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "web..."

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter web build

# Stage 2: serve them with nginx
FROM nginx:stable-alpine

ENV PORT=80
ENV API_UPSTREAM=http://api:3000
ENV API_HOST=api
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html