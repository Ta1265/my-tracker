FROM node:24-bookworm AS base
# Node ships npm only; corepack installs the pnpm version pinned in package.json.
RUN corepack enable
# pnpm's store lives here instead of the default ~/.local/share/pnpm/store, so the
# cache mount below actually points at what pnpm uses.
ENV PNPM_HOME="/pnpm"

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
# The cache mount persists pnpm's store across builds without baking it into a layer.
# --filter installs only the backend package (and its workspace deps, once any exist -
# @portfolio/backend does not depend on frontend or packages/shared yet).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @portfolio/backend...

# 2. Common build stage
FROM base AS common-build
WORKDIR /app
# pnpm keeps the real packages in the workspace root's node_modules; a package's own
# node_modules just symlinks into it, so both need copying or the symlinks dangle.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/
COPY backend/nest-cli.json ./backend/
COPY backend/eslint.config.mjs ./backend/
COPY backend/.prettierrc.json ./backend/
COPY tsconfig.base.json ./tsconfig.base.json

# 3. Target for development
FROM common-build AS dev
WORKDIR /app
CMD ["pnpm", "--filter", "@portfolio/backend", "start:dev"]

# 4. Build stage for production target
FROM common-build AS builder
WORKDIR /app
RUN pnpm --filter @portfolio/backend lint
RUN pnpm --filter @portfolio/backend build

# 5. Deploy stage - self-contained production closure
FROM builder AS deploy
RUN pnpm deploy --filter @portfolio/backend --prod /app/deploy

# 6. Production image
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production

# Runs unprivileged, mirroring frontend/Dockerfile's prod stage - this container holds
# database credentials and, later, session-signing keys.
RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nestjs --uid 1001 --ingroup nodejs

COPY --from=deploy --chown=nestjs:nodejs /app/deploy ./

USER nestjs
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/main.js"]
