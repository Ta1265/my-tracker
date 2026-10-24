<!--
Owned by: bmad-analyst
Read by: bmad-pm

Fill in every section below. Keep it to what's needed to brief the PM - this is not
the PRD, don't write requirements here, just the problem and its boundaries.
-->

# Project Brief: NestJS Backend Migration

## Two overarching rules

These bound everything below. The PM should treat them as non-negotiable and reflect
them in every epic.

**1. Additive only - nothing is deleted.** The existing Next.js API routes under
`src/app/api/` and the code under `src/server/` must NOT be removed, replaced, or
gutted as part of this migration. Old and new coexist for the entire initiative.
Removal of the superseded Next.js API layer is a separate, explicitly deferred task
sequenced at the very end, after everything else is done and signed off.

**2. Scaffold-first, with a human sign-off gate.** Once the NestJS service is stood
up, there is a distinct scaffolding phase before any real implementation: modules,
controllers, and services created with endpoint method signatures as no-op stubs, each
carrying a comment above it describing the actions it will eventually perform. The
owner reviews and signs off on that scaffold before implementation begins. This is a
hard gate, not a suggestion - implementation work must not start until the scaffold is
approved.

The scaffold's deliverable is **not just stub code - it is browsable API
documentation**. Stubs are annotated with `@nestjs/swagger` decorators (request/response
DTOs, response types, one tag per domain) so the generated Swagger UI is a faithful
picture of the planned API surface. The whole point is that the owner reviews the
planned API *as documents* rather than by reading controller code, so the generated
Swagger doc is part of what gets signed off at the gate. A scaffold that compiles but
produces thin or inaccurate Swagger output does not satisfy this gate.

## Problem / Motivation

This is a **learning exercise**. The goal is to build a real NestJS backend and a real
MikroORM data layer against a codebase the owner already knows well, rather than to
fix a production pain point. There is no uptime, deadline, or business pressure.

Today all server-side behavior lives inside Next.js: ~20 App Router route handlers
under `src/app/api`, a NextAuth credentials provider, and a `src/server/` layer holding
Prisma access, Redis, metrics, logging, and price-history helpers. Standing up an
independent NestJS service is the vehicle for learning NestJS module/provider/DI
structure, decomposed domain services, MikroORM, pnpm workspaces, and a monorepo
layout - all against familiar domain logic so the learning is about the tooling, not
the problem space.

## Current State

**API surface** - 19 App Router route handlers under `src/app/api/` plus the NextAuth
catch-all, grouped roughly as:

- `auth/[...nextauth]` - NextAuth v4 handler (GET/POST)
- `transaction/add`, `transaction/[id]` - transaction CRUD
- `summary/*` - `coins`, `portfolio`, `[unit]`, `profitLossChart[/timeFrame]`
- `stats/[unit]`, `product/[product]`
- `exchange-rates/[timeFrame]/[coinName]`, `exchange-rates/unit/[unit]`
- `price-history/check`, `price-history/set`
- `time-frame-coins-pl/[timeFrame]`, `time-frame-total-pl/[timeFrame]`
- `token-info/[userId]`, `token-info/search/[searchTerm]`
- `metrics` - Prometheus scrape endpoint, guarded by a `METRICS_SECRET` bearer token

The handlers are thin: check the session, read params, call into
`src/server/db/dbService.ts` (436 lines of Prisma + raw SQL query logic) or
`src/server/helpers/*` (exchange rates, price history updates, formatting), then shape
a JSON response. Display formatting (`formatUSD`, fixed-decimal strings, `'%'`
suffixes) happens server-side inside these handlers.

**Auth** - `src/server/auth.ts` defines NextAuth v4 with a Credentials provider
(bcrypt against the `User` table), `jwt` session strategy, and callbacks that pack
`userId`/`username`/`email`/`name` into the token and expose a whitelisted session
shape with `isAuthenticated`. `rememberMe` toggles token lifetime between 8 hours and
30 days. It is consumed three ways:

- route handlers call `getServerAuthSession()` to authorize requests
- server components `src/app/page.tsx` and `src/app/login/page.tsx` call it to gate
  and redirect - these are the only non-API server-side session consumers
- the client uses `next-auth/react` (`useSession`, `signIn`) from `LoginClient.tsx`
  and the nav components

**Client data access** - React Query hooks in `src/_hooks/` and several context
providers/components call `fetch('/api/...')` on same-origin relative paths. There is
no API client abstraction; URLs are inline in each hook.

**Data layer** - Prisma 5.6 against MySQL 5.7. Schema and migration history live at
`src/server/db/schema.prisma` and `src/server/db/migrations/`. Models: `User`,
`Transaction`, `TokenInfo`, `TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`,
`OuathToken`.

**Infrastructure** - `docker-compose.yml` runs `next-app`, `portfolio-db` (MySQL 5.7),
`redis`, and an observability stack (Loki, Alloy scraping Docker logs, Prometheus,
Grafana). `nginx` terminates TLS and proxies everything to `next-app:3000`. Logging is
Winston; metrics are `prom-client` via `src/server/metrics.ts`. npm is the current
package manager.

**Noted items to fold in** (not the point of the migration, but relevant):

- `src/app/api/_nextApiCompat.ts` is a Pages-Router handler shim with no remaining
  importers - dead code. It falls under the deferred cleanup task, not this migration.
- `next.config.js` sets `typescript.ignoreBuildErrors: true` and
  `eslint.ignoreDuringBuilds: true`. On a migration of this size those flags will hide
  exactly the breakage this work is most likely to introduce. The PM should treat
  re-enabling them (at least for the new `backend/`, ideally for `frontend/` too) as a
  candidate work item rather than leaving it unexamined.

## Goals

1. **Monorepo restructure.** The bulk of the current tree moves into `frontend/`; the
   new NestJS service lives in `backend/`. Repo-wide concerns stay at root (`docker/`,
   `nginx/`, `monitoring/`, `.claude/`, `docs/`, compose files).
2. **pnpm workspaces** replace npm as the package manager across the monorepo.
3. **A standalone NestJS service exposes every endpoint the app has today**, built
   fresh alongside - never by moving or deleting the Next.js originals.
4. **NestJS owns authentication and the session entirely.** Nest verifies credentials
   against the existing `User` table / bcrypt hashes and issues the session. The
   existing NextAuth setup remains in place and untouched during the migration per the
   additive-only rule; which of the two the frontend actually uses at any given moment
   is a sequencing question for the PM.
5. **MikroORM replaces Prisma in the new backend.** Entities model the existing MySQL
   schema. The schema itself, its data, and the existing Prisma migration history are
   not changed - MikroORM is mapped onto the database as it stands.
6. **Domain-decomposed structure.** `dbService.ts` is decomposed into per-domain Nest
   modules/services (transactions, summary, stats, exchange rates, price history, token
   info, auth) rather than lifted wholesale as one god-service. This decomposition is a
   primary learning objective, and it is also what makes the codebase testable when
   tests are added later - see the testability constraint.
7. **Response contracts preserved exactly**, including current server-side formatting
   (`formatUSD` output, `.toFixed(1) + '%'`, fixed-decimal strings). The frontend must
   not need refactoring to consume the new backend.
8. **Swagger/OpenAPI documentation via `@nestjs/swagger`**, delivered during the
   scaffold phase rather than as later polish. Every endpoint is documented with
   request/response DTOs and a per-domain tag, and Swagger UI is served by the backend.
   The DTOs are where the preserved response contracts (goal 7) get written down and
   pinned, so documentation and contract fidelity are the same piece of work.
9. **Server-rendered session gating still works.** `src/app/page.tsx` and
   `src/app/login/page.tsx` gate on session server-side, so whatever Nest issues must
   be readable from Next.js server components, not just from the browser.
10. **Cross-cutting concerns work in the new service**: Redis, Prometheus metrics
    (including the `METRICS_SECRET`-guarded scrape endpoint), and Winston/Loki logging.
11. **The stack still runs via `docker compose up` locally and behind nginx**, with
    nginx aware of the new backend container.

## Non-Goals / Out of Scope

- **Removing or modifying the existing Next.js API routes or `src/server/` code.** See
  overarching rule 1. Deferred to a final cleanup task.
- **Writing tests.** No test suite for the migrated endpoints as part of this
  initiative - explicit follow-up work. What is deferred is *writing the tests*, not
  *being able to write them later without rework*. See the testability constraint
  below; this non-goal is not permission to build untestable code.
- **Frontend rewrite.** React components, MUI Joy/Tailwind styling, and React Query
  usage stay as they are. The only frontend changes permitted are those forced by the
  monorepo move and by pointing at a different API origin / auth mechanism.
- **Moving formatting to the client.** Response shapes are preserved byte-for-byte
  where practical; no "while we're here" contract improvements.
- **Database changes.** No engine change, no schema change, no rewriting the existing
  Prisma migration history.
- **New features, endpoints, or auth providers** (OAuth, email/passwordless) beyond
  what exists today.
- **Redesigning observability.** Loki/Alloy/Prometheus/Grafana are re-pointed, not
  replaced.
- **Hosting/cloud changes.** Stays Docker Compose behind nginx.

## Constraints

- Personal learning project, single developer, no deadline and **no live-uptime
  requirement**. Prefer clarity, simplicity, and long-term maintainability over
  migration speed.
- **Testability is a design constraint, even though tests are deferred.** Tests get
  written after this initiative, so the code written during it must be testable when
  that happens - without a restructuring pass first. Architect and Dev phases must
  honor three principles:
  - **Depend on abstractions through Nest's DI**, not on module-level singletons or
    direct imports of concrete implementations. A unit under test should receive its
    collaborators, not reach out and construct or import them.
  - **Business logic lives in injectable per-domain services**, not in controllers.
    Controllers stay thin - parse, delegate, respond - so the logic worth testing is
    reachable without an HTTP layer.
  - **Do not hardwire ambient dependencies into logic**: the ORM/EntityManager, the
    session/current user, and the clock (`Date.now()`, `new Date()`) all get injected
    or passed in rather than referenced directly from inside domain logic. These are
    the three that are painful to unpick later.

  Note the pull in the opposite direction: the existing `dbService.ts` mixes raw SQL
  with query logic, and lifting that style intact into a Nest provider would satisfy
  "it works" while quietly failing this constraint. The per-domain decomposition
  (goal 6) is what makes it achievable.
- **Incremental with human sign-off gates.** Work proceeds in reviewable chunks with
  the owner approving between them - explicitly not one big autonomous run. The
  scaffold gate (overarching rule 2) is the first and most important of these.
- **One commit per completed story, after owner review** (see PRD GR-3 for the full
  rule). Work stays uncommitted while a story is in progress; once Dev finishes and the
  owner reviews and signs off, that story's diff is committed as a single commit before
  the next story starts. Superseded from the original "accumulate everything, commit
  once at the end."
- The existing `User` table and bcrypt password hashes must keep working - no forced
  password reset for existing accounts.
- Next.js server components gate on session, so the session mechanism Nest issues must
  be readable server-side in Next, not browser-only.
- Must keep running under Docker Compose + nginx, including the local HTTPS dev flow
  (`setup_local_https.sh`, `nginx/`).
- MySQL 5.7 stays as the database; the frontend stays Next.js 14 App Router.
- Both the legacy Prisma layer and the new MikroORM layer will point at the same
  database simultaneously for the duration of the initiative. That is expected and
  acceptable given the coexistence rule.

## Open Questions

1. **Session/JWT design - belongs to the Architect phase (`bmad-architect`).** The
   owner is leaning toward JWTs and wants a dedicated design discussion. That debate is
   deliberately not resolved here: the Analyst's job is scope and boundaries, and the
   PM's is requirements ("the user can log in and stay logged in"), whereas token
   format, signing, storage, cookie attributes, refresh/expiry handling, and how a
   Next.js server component reads the session are all technical-design decisions tied
   to concrete PRD requirements. Architect is where they get decided.
   The known hard constraints going in: server components must be able to read the
   session; `rememberMe` must still yield 8-hour vs 30-day lifetimes; existing bcrypt
   hashes must keep working.
2. **pnpm/workspace tooling - implementation detail for a later phase, yes.** The
   *decision* to use pnpm and a `backend/` + `frontend/` monorepo is settled and
   recorded above as a goal. How it is realized (workspace file layout, shared
   `tsconfig`/lint config, whether a shared types package exists, Docker build changes
   for pnpm, lockfile handling) is Architect territory, with the mechanical move
   sequenced by the PM as its own story. The PM should not need to specify pnpm
   commands.
3. **Deployment topology.** Nginx routing `/api` to a `backend` container on the same
   domain versus a separate subdomain - this changes cookie domain and CORS decisions,
   so it interacts with question 1 and should be settled alongside it in Architect.
4. **Frontend cutover mechanics.** Given that the old routes stay live, how does the
   frontend switch over - env-var-driven base URL, per-hook switch, or a single
   flip at the end? PM should define the sequencing; Architect the mechanism.
5. **Scope of the `frontend/` move.** Which root-level files genuinely stay at root
   versus move into `frontend/` needs an explicit inventory (e.g. `tailwind.config.ts`,
   `next.config.js`, `types.d.ts`, `public/`, `.eslintrc.cjs`, the two Dockerfiles).
   Worth a PM story of its own since it touches everything.
6. **Swagger DTOs versus "preserve response contracts exactly" - an interaction the
   Architect must resolve.** These two requirements meet in the same artifact: the
   DTOs are where the existing response shapes get written down and pinned. That is
   mostly a benefit (the scaffold's documentation doubles as the contract spec), but it
   creates a specific tension worth naming. Several current responses return
   *pre-formatted strings*, not numbers - `formatUSD` output like `"$1,234.56"`,
   percentages as `.toFixed(1) + '%'`, holdings as fixed-decimal strings. Honest DTOs
   must therefore type these fields as `string` with examples showing the formatted
   value, which will look wrong to anyone expecting a numeric API. The Architect needs
   to decide explicitly that this is intended and document why, rather than letting a
   well-meaning "fix" to the DTO types silently break the frontend. Related: whether
   DTOs are hand-written or derived, and where the formatting helpers live in the new
   backend, since the DTO and the formatter have to agree.
7. **Swagger UI exposure.** Whether Swagger UI is served in production or dev-only, and
   whether it sits behind auth, is a small Architect decision - noting it here so it
   isn't discovered late. It interacts with the nginx routing question above.
8. **`next.config.js` build-error suppression.** Re-enable type/lint checking as part
   of this work, or leave it alone? Analyst recommendation is to enable it for
   `backend/` from day one at minimum.
