
FROM node:18-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

# 2. Common build stage
FROM base AS common-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY src ./src
COPY public ./public
COPY next.config.js .
COPY tsconfig.json .
COPY next-env.d.ts .
COPY tailwind.config.ts .
COPY postcss.config.js .
COPY types.d.ts .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npx prisma generate

# 2. Target for development
FROM common-build AS dev
WORKDIR /app
# Note: use RUN during the build, CMD during the run
CMD ["npm", "run", "dev"]

# 2. Build stage for production target
FROM common-build AS builder
WORKDIR /app
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD HOSTNAME="0.0.0.0" node server.js
# CMD ["next", "start"]