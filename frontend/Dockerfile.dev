FROM node:18-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
# RUN \
#   if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
#   elif [ -f package-lock.json ]; then npm ci; \
#   elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
#   # Allow install without lockfile, so example works even without Node.js installed locally
#   else echo "Warning: Lockfile not found. It is recommended to commit lockfiles to version control." && yarn install; \
#   fi

COPY src ./src
COPY public ./public
COPY next.config.js .
COPY tsconfig.json .
COPY next-env.d.ts .
COPY tailwind.config.ts .
COPY postcss.config.js .
COPY types.d.ts .

# Next.js collects completely anonymous telemetry data about general usage. Learn more here: https://nextjs.org/telemetry
# Uncomment the following line to disable telemetry at run time
ENV NEXT_TELEMETRY_DISABLED 1

# Note: Don't expose ports here, Compose will handle that for us

# Start Next.js in development mode based on the preferred package manager
RUN npm run generate
# RUN npm run build
# EXPOSE 3001  
# RUN npm run start
# CMD ["npm", "start"]
CMD ["npm", "run", "dev"]