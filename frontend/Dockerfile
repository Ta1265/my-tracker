
# FROM node:18-alpine AS base
FROM node:24-bookworm AS base
# Node ships npm only; corepack installs the pnpm version pinned in package.json.
RUN corepack enable
# pnpm's store lives here instead of the default ~/.local/share/pnpm/store, so the
# cache mount below actually points at what pnpm uses.
ENV PNPM_HOME="/pnpm"

# 1. Install dependencies only when needed
FROM base AS deps
# RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/
# @portfolio/frontend's `...` filter only pulls @portfolio/shared in as a prod dependency;
# naming it directly also installs its own devDependency (typescript) needed for its `tsc` build.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @portfolio/frontend... --filter @portfolio/shared

# 2. Common build stage
FROM base AS common-build
WORKDIR /app
# pnpm keeps the real packages in the workspace root's node_modules; a package's own
# node_modules just symlinks into it, so both need copying or the symlinks dangle.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY frontend/package.json ./frontend/
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/next.config.js ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/next-env.d.ts ./frontend/
COPY frontend/tailwind.config.ts ./frontend/
COPY frontend/postcss.config.js ./frontend/
COPY frontend/types.d.ts ./frontend/
COPY frontend/types ./frontend/types
COPY frontend/orval.config.ts ./frontend/
COPY tsconfig.base.json ./tsconfig.base.json
# Orval formats its output through Prettier's API, which resolves config by walking up
# from the generated file - so the root config has to exist in the image.
COPY prettier.config.mjs ./prettier.config.mjs
COPY packages/shared ./packages/shared
# packages/shared has its own tsc build; neither `next dev` nor `next build` runs it, and
# both resolve the package through its compiled dist/, so this must precede them.
RUN pnpm --filter @portfolio/shared build
ENV NEXT_TELEMETRY_DISABLED 1

# 2. Target for development
FROM common-build AS dev
WORKDIR /app
# Note: use RUN during the build, CMD during the run
CMD ["pnpm", "--filter", "@portfolio/frontend", "dev"]

# 2. Build stage for production target
FROM common-build AS builder
WORKDIR /app
RUN pnpm --filter @portfolio/frontend build

# 3. Production image, copy all the files and run next
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nextjs -uid 1001

# RUN adduser --disabled-password --gecos "" --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/frontend/public ./frontend/public

# Set the correct permission for prerender cache
RUN mkdir -p frontend/.next
RUN chown nextjs:nodejs frontend/.next

# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static


USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD HOSTNAME="0.0.0.0" node frontend/server.js
# CMD ["next", "start"]
