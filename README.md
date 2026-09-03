# Portfolio

A crypto portfolio tracker. It ingests your transactions, prices them against live exchange
rates, and organizes it all in a customizable dashboard.

## Stack

- **Frontend** - Next.js 14 (App Router), MUI, TanStack Query, Chart.js
- **Backend** - NestJS 11, MikroORM
- **Data** - MySQL, Redis
- **Infrastructure** - Docker Compose, nginx
- **Observability** - Grafana, Loki, Prometheus
- **Tooling** - TypeScript, pnpm workspace, Orval

## Quick start

Requires Docker, Node 24, and pnpm.

```sh
pnpm install                            # host-side only: IDE types and linting
sudo ./setup_local_https.sh             # one-time, macOS + mkcert
docker network create portfolio-network # compose declares it external
docker compose up -d --build
```

| | |
| --- | --- |
| App | `https://www.tubesock.xyz` |
| API docs | `https://www.tubesock.xyz/backend/docs` |
| Grafana | `http://localhost:3001` |

Compose builds the `dev` target by default; set `TARGET=prod` for a production build.

## Project layout

A pnpm workspace of three package groups: `frontend` (Next.js), `backend` (NestJS), and
`packages/*`. `packages/shared` carries the session-claim contract that both apps sign and
verify against.

nginx terminates TLS and splits traffic by path: `/backend/` to the API, everything else
to Next.js.

## Database migrations

```sh
docker exec nest-api pnpm migration:create   # blank stub in backend/src/db/migrations/
docker exec nest-api pnpm migration:list     # what has been applied
docker exec nest-api pnpm migration:up       # apply everything pending
docker exec nest-api pnpm migration:down     # refuses on the baseline
docker compose run --rm migrations           # deploy path: apply pending, then exit
```

## API client generation

The backend publishes its OpenAPI document at `/backend/docs-json`. [Orval](https://orval.dev/docs)
reads it and writes `frontend/src/api/generated.ts`, which is committed. Regenerate after
changing any backend DTO or controller signature:

```sh
docker exec next-app pnpm --filter @portfolio/frontend spec:generate
```

## Observability

Grafana, Loki, and Prometheus run alongside the app, with the dashboard and datasources
auto-provisioned on first boot. See [OBSERVABILITY.md](OBSERVABILITY.md).
