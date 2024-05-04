
# FROM node:18-alpine AS base

# # 1. Install dependencies only when needed
# FROM base AS deps
# # Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# RUN apk add --no-cache libc6-compat

# WORKDIR /app

# # Install dependencies based on the preferred package manager
# # COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
# # RUN \
# #   if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
# #   elif [ -f package-lock.json ]; then npm ci; \
# #   elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
# #   else echo "Lockfile not found." && exit 1; \
# #   fi

# COPY package.json ./
# COPY package-lock.json ./
# RUN npm ci


# # 2. Rebuild the source code only when needed
# FROM base AS builder
# WORKDIR /app
# COPY --from=deps /app/node_modules ./node_modules
# COPY --from=deps /app/package.json ./package.json
# COPY --from=deps /app/package-lock.json ./package-lock.json
# COPY src ./src
# COPY public ./public
# COPY next.config.js .
# COPY tsconfig.json .
# COPY next-env.d.ts .
# COPY tailwind.config.ts .
# COPY postcss.config.js .
# COPY types.d.ts .
# # This will do the trick, use the corresponding env file for each environment.
# RUN npm run build

# # 3. Production image, copy all the files and run next
# FROM base AS runner
# WORKDIR /app

# ENV NODE_ENV=production

# RUN addgroup -g 1001 -S nodejs
# RUN adduser -S nextjs -u 1001

# COPY --from=builder /app/public ./public

# # Automatically leverage output traces to reduce image size
# # https://nextjs.org/docs/advanced-features/output-file-tracing
# COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static


# USER nextjs

# EXPOSE 3000

# ENV PORT 3000
# ENV HOSTNAME localhost



FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN  npm ci

# FROM node:18-alpine AS builder
WORKDIR /app
# COPY --from=deps /app/node_modules ./node_modules
# COPY . .

COPY package.json .
COPY package-lock.json .
COPY src ./src
COPY public ./public
COPY next.config.js .
COPY tsconfig.json .
COPY next-env.d.ts .
COPY tailwind.config.ts .
COPY postcss.config.js .
COPY types.d.ts .

# ENV NEXT_TELEMETRY_DISABLED 1

# RUN npm run generate
RUN npx prisma generate
RUN npm run build


# FROM node:18-alpine AS runner
# WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

# COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/package.json ./package.json
# COPY --from=builder --chown=nextjs:nodejs /app/src/server/db ./src/server/db
# COPY --chown=nextjs:nodejs ./.next ./.next
# COPY --chown=nextjs:nodejs ./src/server/db ./src/server/db


# USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]