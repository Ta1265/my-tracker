# Story 3.4: EntityManager-by-DI pattern, raw-query convention, and TZ verification

Status: Done

## Context

Architecture calls this story out by name as the one worth over-investing in: "Story 3.4
is the load-bearing one: it fixes the EM-by-injection pattern, the raw-query pattern,
and the TZ verification that every Epic 5 story then inherits." Everything this story
settles is inherited wholesale by story 5.1 (the first domain story to actually use it)
and every domain story after it - a mistake here is a mistake repeated seven times, not
once.

Three separate things land in this one story because they share a root cause: how a
request-scoped read reaches the database correctly and at the right moment in time.

1. **Per-request EntityManager forking**, so two concurrent HTTP requests never share
   mutable ORM state.
2. **The convention for which queries go through the ORM and which go through raw SQL**,
   settling D16's split before any real domain service is written against it.
3. **Timezone**, because `NetCashFlow.date`/`TokenPriceHistory.date` are `DATE` columns
   and Epic 5's time-frame boundaries are computed from the current time - a container
   timezone mismatch shifts those boundaries by hours in a way that looks like a query
   bug, not a config one.

## Acceptance Criteria

### A. Per-request EntityManager forking via `MikroOrmMiddleware`

- [x] `backend/src/app.module.ts`'s `AppModule` class implements Nest's `NestModule` and
      registers `configure(consumer: MiddlewareConsumer)` applying
      `MikroOrmMiddleware` (from `@mikro-orm/nestjs`) to all routes
      (`consumer.apply(MikroOrmMiddleware).forRoutes('{*path}')` - Nest 11's named
      wildcard syntax; the original `'*'` form only worked through a deprecated
      `LegacyRouteConverter` shim and logged a boot warning, fixed after review round 1
      (F2)).
- [x] This is a deliberate choice over two rejected alternatives, recorded here so it is
      not "simplified" later: **not** manual `em.fork()` per service (D15 - boilerplate
      that will eventually be omitted in one service, and the resulting bug is a
      cross-request data leak that is extremely hard to see), and **not** Nest
      `Scope.REQUEST` providers (request scope is contagious up the entire injection
      chain with real instantiation cost, and buys nothing over the middleware's
      `AsyncLocalStorage`-backed context).
- [x] Demonstrate the fork is real, not just configured: add a temporary diagnostic - a
      route or a script firing two requests/contexts in quick succession, each logging
      the injected `EntityManager`'s `em.id` - and confirm the two ids differ from each
      other and from the root EM's id (architecture's own spike observed ids 5 and 7
      against a root id of 2, as a reference point, not a value to reproduce exactly).
      Record the actual ids observed in Dev Notes, then remove the temporary
      route/script - it does not ship as part of this story's committed code.

### B. Current user and clock stay explicit parameters, never ambient

- [x] Record in Dev Notes (no code required beyond what section A/C already produce)
      that this story does not introduce any ambient current-user or ambient-time
      access. This is a restatement-once of NFR-1's binding rule for this epic's own
      benefit: "current user / session ... passed explicitly as a parameter from
      controller into service. It never arrives ambiently" and "clock ... injected". Both
      land for real in Epic 4 (4.2 for the clock, 4.4+ for the user) - this story's job
      is only to confirm nothing added here creates an ambient exception to either rule
      for Epic 5 to inherit accidentally (e.g. no helper that reaches into
      `AsyncLocalStorage` for "the current user" the way it legitimately does for the
      EntityManager fork and, later, the request-id in story 4.1).

### C. Raw-vs-ORM query convention, demonstrated on one real read

- [x] Document the convention (in this story's Dev Notes, as the decision record every
      Epic 5 story cites by pointing back here - no new source file is required to state
      a convention that architecture D16 already justifies):
      **`em.getConnection().execute(sql, params)`** for the aggregate/rollup queries
      `dbService.ts` currently expresses as raw `$queryRaw` (portfolio and summary
      rollups, exchange-rate `MAX(date)` subqueries, time-frame P/L computations) -
      because for these the SQL *is* the FR-3 contract, and rewriting it as QueryBuilder
      while also proving byte-for-byte parity is two risky changes stacked on one.
      **`em.getRepository(Entity)` / `em.find()` / `em.findOne()`** for the simple,
      single-table operations (transaction insert/delete, user lookup by username,
      token-info finds and search, exchange-rate finds) - this is where the ORM earns
      its keep.
- [x] Demonstrate the ORM half of the convention with one real read: a temporary
      script or diagnostic (same one-off, not-committed convention as 3.2/3.3's
      verification, and as 1.4's precedence-order checks) that resolves the forked
      `EntityManager` via constructor injection in a tiny demonstration provider, and
      issues one real `em.getRepository(User).findOne({ username: <a real username> })`
      (or equivalent) against `portfolio-db`. Paste the transcript into Dev Notes: query
      issued, row returned, and the runtime JS type of every field (continuing the
      per-field type-checking discipline stories 3.2/3.3 started).
- [x] The raw-SQL half of the convention is **not** demonstrated with an actual query in
      this story - there is no aggregate query to port yet (that starts in Epic 5). This
      story states the convention and cites D16; story 5.1 is the first to write one.

### D. Timezone pinned and verified

- [x] `docker-compose.yml`'s `nest-api` service (`docker-compose.yml:75-93`) gains
      `environment: TZ: UTC` (a plain Compose `environment:` block - `nest-api` has none
      today, unlike `next-app`'s existing `environment: HOST: 0.0.0.0` at line 48-49; add
      a sibling block, don't touch `next-app`'s).
- [x] Verify `next-app`'s **effective** timezone (not just an env var, since none is set
      there today) - e.g. `docker compose exec next-app date` or an equivalent runtime
      check - and record what it actually is. If it is not UTC, record that fact plainly
      rather than silently reconciling it; this is a comparison to make explicit, not a
      mismatch to fix by editing `frontend/` (GR-1 - and if it doesn't matter today
      because nothing on the frontend does `DATE`-column arithmetic against the current
      time, say so).
- [x] Verify `nest-api`'s effective timezone is UTC after the compose change: `docker
      compose up -d --build nest-api` then `docker compose exec nest-api date` (or `node
      -e "console.log(new Date().toString())"` inside the container) shows UTC.
- [x] Record the comparison result in Dev Notes - this is the recorded evidence Epic 5's
      time-frame stories build on, per architecture: "next-app's effective timezone is
      verified to match during story 3.4, with the result recorded."

### E. Regression and full-epic sign-off

- [x] `docker compose up -d --build` brings up the full stack cleanly (NFR-3, still
      holding at the end of every story), and `GET /backend/api/health` through nginx
      still returns `200`.
- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, and `lint` all pass.
- [x] No file under `frontend/` is touched (GR-1) except read-only inspection for the
      timezone check in section D.
- [x] No temporary diagnostic route or script from sections A or C remains in the
      committed diff.

## Technical Notes

### `@mikro-orm/nestjs@7.0.2` on this stack, already spiked

Architecture records this as already verified end to end on this exact combination: Nest
11 built with `module: commonjs`, `@mikro-orm/nestjs@7.0.2`'s `MikroOrmMiddleware`
established distinct EM forks per request (ids 5 and 7 against root id 2). This story
reproduces that check against the epic's own entities (3.2/3.3) rather than trusting the
architecture-phase spike, since the entities and the app wiring are new since then.

### What NFR-1 is checking for here specifically

The EntityManager, the current user, and the clock are the three "painful to unpick
later" ambient dependencies NFR-1 names. This story closes the first one structurally
(constructor injection via the middleware-backed fork) and confirms in writing that the
other two remain untouched exceptions for Epic 4 to close for real - not because this
story implements them, but because a story that touches DI wiring is exactly the kind of
place an ambient shortcut quietly creeps in if nobody is checking for it.

## Out of Scope

- The clock abstraction and its first real consumer (`rememberMe` expiry) - story 4.2.
- Global error handling/response shaping - story 4.3.
- Any actual raw aggregate query - the first one is story 5.1 (transactions) or
  wherever Epic 5 first needs one; this story only fixes the convention.
- Any domain module's real implementation - Epic 5.
- `packages/shared`, sessions, cookies, credential verification - Epic 4.

## Dev Notes

### Section A - EM fork evidence

A temporary `DiagTempController` (`backend/src/diag-temp.controller.ts`, registered
transiently in `AppModule.controllers`) exposed `GET /backend/api/diag-temp/em-id`,
constructor-injecting `EntityManager` from `@mikro-orm/mysql` and returning `em.id`.
Booted `nest-api` with the section D compose change already applied, then:

- Resolved the **root** EM id (the un-forked instance MikroORM registers at bootstrap,
  before any request middleware runs) via a one-off `NestFactory.createApplicationContext`
  script run inside the `nest-api` container: `orm.em.id` → **2**.
- Two successive `GET /backend/api/diag-temp/em-id` requests (via `docker exec nest-api
  node -e "require('http').get(...)"`, hitting the app directly on port 3001) returned
  `{"emId":13}` and `{"emId":15}` - two different ids, both different from the root id
  `2`. This reproduces the architecture-phase spike's finding (ids 5/7 against root 2)
  against this epic's actual entities and app wiring, as the story requires; the exact
  numbers differ because more of the app (Swagger doc build, entity discovery) had
  already incremented MikroORM's internal EM counter by the time these requests ran.

`diag-temp.controller.ts` was deleted and the `AppModule` import/registration reverted
before finishing the story - confirmed absent from `git status`/`git diff` at the end of
the story (section E's `- [x]`).

### Section B - no ambient current-user or clock introduced

Nothing in this story's diff (`app.module.ts`, `docker-compose.yml`) reads the current
user or the current time. The only new ambient mechanism is `MikroOrmMiddleware`'s
`AsyncLocalStorage`-backed context, and it holds exactly one thing: the forked
`EntityManager`, which is what section A explicitly asks for. No helper was added that
reaches into that context (or any other) for "the current user" or "now" - both stay out
of scope here per Epic 4 (4.2 for the injectable `Clock`, 4.4+ for the user), leaving
nothing for Epic 5 to inherit as an accidental ambient exception to NFR-1.

### Section C - raw-vs-ORM convention (decision record) and ORM demonstration

**Convention (cited by every Epic 5 story from here on, per D16):**

- **`em.getConnection().execute(sql, params)`** for the aggregate/rollup queries
  `dbService.ts` expresses as raw `$queryRaw` today: the portfolio and summary rollups,
  the exchange-rate `MAX(date)` subqueries, and the time-frame P/L computations. For
  these the SQL itself is the FR-3 contract - rewriting it as QueryBuilder while also
  proving byte-for-byte parity against the old stack would be two risky changes stacked
  on one, so it stays verbatim.
- **`em.getRepository(Entity)` / `em.find()` / `em.findOne()`** for the simple,
  single-table operations: transaction insert/delete, user lookup by username,
  token-info finds and search, exchange-rate finds. This is where the ORM earns its
  keep, and where MikroORM's identity map / typed repositories are actually useful.
- The raw-SQL half is **not** exercised with a real query in this story - there is no
  aggregate query to port yet. Story 5.1 is the first to write one, citing this section
  for the convention.

**ORM half demonstrated** via the same temporary `DiagTempController`, a second route
`GET /backend/api/diag-temp/user-lookup` calling
`this.em.getRepository(User).findOne({ username: 'test' })` against the live
`portfolio-db` (username `test`, id `2`, confirmed present via `SHOW`-equivalent
`SELECT id, username FROM PORTFOLIO.User`). Transcript:

```
GET /backend/api/diag-temp/user-lookup
200 {
  "found": true,
  "fields": {
    "id": "number: 2",
    "name": "string: \"Test\"",
    "email": "string: \"test@test.com\"",
    "password": "string: \"$2b$10$fnR0Sx2Z1EJoZWaaF9qMWeXy83Zyb5ISiQN6kGPxfR5A2b1VDCXcK\"",
    "username": "string: \"test\"",
    "image": "object: null"
  }
}
```

Every field present and typed as expected from story 3.2's `User` entity: `id: number`,
`name`/`email`/`password`/`username: string`, `image: null` (nullable string column,
unset for this row). No type-coercion issue surfaced for this simple `findOne` - the
raw-deserialization drift risk architecture flags (D16's named risk) applies to the raw
aggregate path, not this one.

### Section D - timezone pin and comparison

`docker-compose.yml`'s `nest-api` service gained a sibling `environment: TZ: UTC` block
(next to its existing `env_file:`, not touching `next-app`'s own `environment:` block).

Verified after `docker compose up -d --build nest-api`:

- `docker compose exec nest-api date` → `Thu Aug 20 12:47:35 UTC 2026`.
- `docker compose exec nest-api sh -c 'echo $TZ'` → `UTC`.
- `docker compose exec next-app date` → `Thu Aug 20 12:47:36 UTC 2026`.
- `docker compose exec next-app sh -c 'echo TZ=$TZ'` → `TZ=` (no `TZ` env var set on
  `next-app` today, and this story does not add one - GR-1 forbids touching
  `frontend/`/its compose service beyond this read-only check).

**Result: both containers' effective timezone is UTC**, and they agree. `next-app`'s
image ships with a UTC system clock even with no `TZ` env var set, so there is no
mismatch to reconcile and nothing to flag as a frontend gap - `next-app` was already
computing time-frame boundaries in UTC before this story, and `nest-api` now explicitly
pins the same. This is the recorded comparison Epic 5's time-frame stories (`h`/`d`/`w`
boundary arithmetic against `NetCashFlow.date`/`TokenPriceHistory.date`) can build on
without re-deriving it.

### Section E - regression

- `docker compose up -d --build` (full stack, all services) came up cleanly; `docker
  compose ps` showed every service `Up`.
- `curl -k https://www.tubesock.xyz/backend/api/health` → `HTTP 200`
  `{"status":"ok"}` (the correct `Host` header for this environment's nginx config,
  matching story 1.5's verification pattern - a bare `curl http://localhost/...` 404s
  here because the nginx image's own stock `conf.d/default.conf` is the port-80 default
  server when the `Host` header doesn't match `tubesock.xyz`/`www.tubesock.xyz`; this is
  pre-existing nginx behavior from story 1.5, not something this story touches).
- `curl -k https://www.tubesock.xyz/login` → `HTTP 200`, confirming `next-app` regression
  is clean.
- No file under `frontend/` was modified - only read-only `docker compose exec next-app
  date`/`echo $TZ` inspection for section D.
- `git status`/`git diff --stat` at the end of the story show only `backend/src/app.module.ts`
  and `docker-compose.yml` changed - the temporary `diag-temp.controller.ts` and its
  `AppModule` registration are fully reverted.

### Post-review update (round 1, F2)

`consumer.apply(MikroOrmMiddleware).forRoutes('*')` used the pre-Nest-11 wildcard
syntax, which only worked through a deprecated `LegacyRouteConverter` auto-conversion
shim and logged a `WARN` on every boot (`docker logs nest-api`:
`Unsupported route path: "/backend/api/*" ... Attempting to auto-convert to
"/backend/api/{*path}"...`). Changed to `.forRoutes('{*path}')`, the form Nest's own
warning names. Verified: `docker logs nest-api --since 1m` after the reload shows no
`LegacyRouteConverter` line, and `docker exec nest-api curl -s
http://localhost:3001/backend/api/health` still returns `{"status":"ok"}` with `HTTP
200`, confirming the middleware still applies to every route under the new matcher.

### Post-story update (owner feedback round 3, redundant middleware application removed)

Section A's `AppModule.configure()`/`consumer.apply(MikroOrmMiddleware)
.forRoutes('{*path}')` was removed. `MikroOrmCoreModule` (`@mikro-orm/nestjs`,
registered by `DbModule`'s `MikroOrmModule.forRootAsync()`) already implements
`NestModule` itself and applies `MikroOrmMiddleware` to every route in its own
`configure()`, unless `registerRequestContext: false` is passed - which nothing in this
codebase does. Nest calls `configure()` on every module in the whole container graph
(`@nestjs/core/middleware/middleware-module.js`'s `resolveMiddleware()` iterates
`container.getModules()`, not just `AppModule`'s direct imports), so this was already
running before `AppModule`'s own identical second application ran - the explicit call
this section originally added was a no-op duplicate, not a distinct mechanism.

This section's actual finding - that a request-scoped read needs a per-request EM fork,
and that the middleware is the right way to get one over manual `em.fork()` or
`Scope.REQUEST` - is unchanged; only which module applies it changed. Re-verified live in
the running `nest-api` container after the removal: two successive
`GET /backend/api/diag-temp/em-id` requests (via a temporary diagnostic controller, added
and removed the same way section A's original was) returned `{"emId":10}` and
`{"emId":11}` - still two distinct forked ids, reproducing this section's original
finding (ids 13/15 against root 2) under the automatic-only wiring. `docker logs
nest-api` shows no `LegacyRouteConverter` warning (there is no explicit `forRoutes()`
call left anywhere in this codebase's own source to trigger it). `AppModule` no longer
implements `NestModule` or imports `MikroOrmMiddleware`/`MiddlewareConsumer`. See the
epic file's Round 3 update for the source citations and the full verification record.

### Changed Files

~ backend/src/app.module.ts   `AppModule` implemented `NestModule` and applied `MikroOrmMiddleware` to all routes via `configure()`; review round 1 (F2) switched `forRoutes('*')` to the Nest 11 `forRoutes('{*path}')` form to drop the `LegacyRouteConverter` boot warning; owner feedback round 3 removed this wiring entirely as a redundant duplicate of `MikroOrmCoreModule`'s own automatic middleware application (see Post-story update below) - `AppModule` no longer implements `NestModule`
~ docker-compose.yml          `nest-api` service gains `environment: TZ: UTC`

### Verification

- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no errors).
- `pnpm --filter @portfolio/backend typecheck` - passed (`tsc --noEmit -p tsconfig.json`, no errors).
- `pnpm --filter @portfolio/backend lint` - passed with the repo's one pre-existing
  warning in `src/main.ts` (`no-floating-promises` on `bootstrap()`), unrelated to this
  story; no errors.
- `docker compose up -d --build nest-api` then full `docker compose up -d --build` - both
  brought the stack up cleanly, all services `Up`.
- `curl -k https://www.tubesock.xyz/backend/api/health` - `HTTP 200` `{"status":"ok"}`.
- `curl -k https://www.tubesock.xyz/login` - `HTTP 200` (next-app regression).
- Round 1 (F2) re-verification: `docker logs nest-api` after the `nest start --watch`
  hot-reload picked up the `'{*path}'` change shows all routes re-mapped with no
  `LegacyRouteConverter` warning; `docker exec nest-api curl -s
  http://localhost:3001/backend/api/health -w "\nHTTP %{http_code}\n"` returned
  `{"status":"ok"}` / `HTTP 200`.
- EM fork evidence (section A) and ORM read (section C) - see transcripts above, captured
  before the temporary diagnostic controller was removed.
- Timezone comparison (section D) - see transcripts above.
- Round 3 re-verification (redundant middleware removal): `pnpm --filter
  @portfolio/backend typecheck`/`lint`/`build` all pass; `docker compose up -d --build`
  brought the full stack up cleanly; `docker logs nest-api` shows `DbModule`/
  `MikroOrmCoreModule` initialized, all routes mapped, no `LegacyRouteConverter`
  warning; two successive `GET /backend/api/diag-temp/em-id` (temporary controller,
  added and removed) returned `{"emId":10}` and `{"emId":11}` - distinct forks, proving
  `MikroOrmCoreModule`'s own automatic middleware application is sufficient without
  `AppModule`'s now-removed explicit one; `curl -sk
  https://www.tubesock.xyz/backend/api/health` -> `200`; `curl -sk
  https://www.tubesock.xyz/login` -> `200`.
