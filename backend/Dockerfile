# Stage 1 - Base
FROM node:24-bookworm AS base
RUN corepack enable
# Must match the --mount target below or the pnpm store cache silently misses.
ENV PNPM_HOME="/pnpm"

# Stage 2 - Dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
# Without this the install exits 0 and leaves a dangling @portfolio/shared symlink.
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install \
    --frozen-lockfile \
    --filter @portfolio/backend...

# Stage 3 - Common build
FROM base AS common-build
WORKDIR /app
COPY --from=deps /app ./
COPY packages/shared ./packages/shared
RUN pnpm --filter @portfolio/shared build

COPY backend ./backend

# Stage 4 - Development
FROM common-build AS dev
WORKDIR /app/backend
ENV NODE_ENV=development
CMD ["pnpm", "start:dev"]

# Stage 5 - Production build
FROM common-build AS builder
RUN pnpm --filter @portfolio/backend build

# Stage 6 - Deploy closure
FROM builder AS deploy
RUN pnpm deploy --filter @portfolio/backend --prod /app/deploy

# Stage 7 - Production
FROM node:24-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nestjs --uid 1001 --ingroup nodejs

COPY --from=deploy --chown=nestjs:nodejs /app/deploy ./

USER nestjs
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/main.js"]

# Stage 8 - Migrations
FROM prod AS migrations
# Not pnpm: pnpm 11 reinstalls deps first, needing a writable /app and the registry.
CMD ["node_modules/.bin/mikro-orm", "migration:up"]
