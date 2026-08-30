
# Developer setup

## Prerequisites

- Node 24 - the root `.nvmrc` pins `24`, and both `frontend/package.json` and
  `backend/package.json` declare `"engines": { "node": ">=24 <25" }`.
- pnpm - the root `package.json` pins the exact version via
  `"packageManager": "pnpm@11.22.0"`.
- Docker and Docker Compose.

## Workspace layout

This is a pnpm workspace (`pnpm-workspace.yaml`) made up of three package groups:
`frontend`, `backend`, and `packages/*`, sharing a single root `pnpm-lock.yaml` (there is
no `package-lock.json` anywhere in the repo). `injectWorkspacePackages: true` is set, so
workspace dependencies are inlined rather than symlinked.

`packages/shared` (`@portfolio/shared`) holds only the session claim contract consumed by
both apps: the `SessionClaims` interface, and the `SESSION_ALGORITHM` and
`SESSION_COOKIE_NAME` constants. Both `frontend` and `backend` depend on it as
`"@portfolio/shared": "workspace:*"`.

Install everything from the repo root:

```sh
pnpm install
```

## The frontend's internal layout

- `frontend/src/auth/` is the auth seam: `session.ts` and `serverSession.ts` (moved here
  from `frontend/src/server/`), plus `target.ts`, `actions.ts`, and
  `useCurrentSession.ts`. It's a deliberate mix of server-only and `'use client'` files,
  with no barrel file.
- `frontend/src/server/` still holds the pre-existing Next.js API layer - `auth.ts`,
  `logger.ts`, `metrics.ts`, `redisClient.ts`, `db/`, `helpers/` - none of which has moved.
- `frontend/src/api/` holds the Orval-generated client (`generated.ts`) and its mutator
  (`http-client.ts`); see the section below for how `generated.ts` gets regenerated.

## Bringing up the stack

```sh
docker compose up -d --build
```

This builds the `dev` target by default (`target: ${TARGET:-dev}` in
`docker-compose.yml`); set `TARGET=prod` in the environment for a production-target
build instead.

One-time local HTTPS setup on macOS, using mkcert (see the script's own header comment
for the full list of what it does and assumes):

```sh
sudo ./setup_local_https.sh
```

After that, the stack is reachable at `https://www.tubesock.xyz`.

## The nginx topology

`nginx/nginx.conf` terminates TLS, redirects port 80 to 443, and then splits traffic by
path: `location /backend/` proxies to `nest-api:3001`, and everything else proxies to
`next-app:3000`.

Swagger UI is served at `https://www.tubesock.xyz/backend/docs` (the backend's OpenAPI
JSON - which the Orval section below already covers - is at `/backend/docs-json`).
`nest-api` also publishes `127.0.0.1:3002:3001`, for browsing Swagger directly from the
host without going through nginx; it isn't needed for `spec:generate` below, which runs
inside the `next-app` container over the Compose network.

# Database migrations

Migrations are hand-written SQL.

```sh
docker exec nest-api pnpm migration:create   # blank stub in backend/src/db/migrations/
docker exec nest-api pnpm migration:list     # what has been applied
docker exec nest-api pnpm migration:up       # apply everything pending
docker exec nest-api pnpm migration:down     # refuses on the baseline - see its down()
docker compose run --rm migrations           # deploy path: applies pending, then exits
docker exec portfolio-db mysql -uroot -proot PORTFOLIO -e "select * from mikro_orm_migrations"  # the ledger
```

Migrations never run at app boot. The ledger above is what stops the baseline from
running a second time.

# API client type generation with [Orval](https://orval.dev/docs)

The backend serves its OpenAPI document at `/backend/docs-json` and republishes it
automatically on save (`nest start --watch`). Orval reads that URL on the frontend and writes
`frontend/src/api/generated.ts`. The generated types and hooks in this file should be committed.

After changing a backend DTO or controller signature, regenerate the frontend types and hooks.

```sh
docker exec next-app pnpm --filter @portfolio/frontend spec:generate
```
