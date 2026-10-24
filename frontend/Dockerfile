# Stage 1 - Base
FROM node:24-bookworm AS base
RUN corepack enable
# Must match the --mount target below or the pnpm store cache silently misses.
ENV PNPM_HOME="/pnpm"

# Stage 2 - Dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
# Without this the install exits 0 and leaves a dangling @portfolio/shared symlink.
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install \
    --frozen-lockfile \
    --filter @portfolio/frontend...

# Stage 3 - Common build
FROM base AS common-build
WORKDIR /app
COPY --from=deps /app ./
COPY packages/shared ./packages/shared
RUN pnpm --filter @portfolio/shared build
ENV NEXT_TELEMETRY_DISABLED=1

COPY frontend ./frontend

# Stage 4 - Development
FROM common-build AS dev
CMD ["pnpm", "--filter", "@portfolio/frontend", "dev"]

# Stage 5 - Production build
FROM common-build AS builder
RUN pnpm --filter @portfolio/frontend build

# Stage 6 - Production
FROM node:24-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nextjs --uid 1001 --ingroup nodejs

COPY --from=builder /app/frontend/public ./frontend/public

RUN mkdir -p frontend/.next && chown nextjs:nodejs frontend/.next

COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "frontend/server.js"]
