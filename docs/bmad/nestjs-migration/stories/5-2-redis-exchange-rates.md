# Story 5.2: Redis provider, then exchange rates

Status: Done

## Context

Exchange rates is the first Redis consumer (PRD cross-cutting table: "Redis provider |
5.2 | Exchange rates is the first cache consumer"), so the injectable Redis provider
lands here and every later story that touches Redis (5.3 indirectly, 5.4, 5.6) takes it
as given rather than building its own client.

This story also builds `ExchangeRatesService`, which is a genuine **cross-domain**
dependency, not just this module's own controller logic - `getPriceHistoryForTimeFrame`
is called by token-info's sync (5.3), summary's profitLossChart (5.6), and both
time-frame P/L endpoints (5.8), and `refreshRates()` is called by summary (5.5, 5.6) and
stats (5.7). `ExchangeRatesModule` must `export` the service and later modules `import`
`ExchangeRatesModule` to inject it - name the export now so 5.3/5.6/5.8 don't each
invent their own copy.

Follows story 5.1's established pattern: `EntityManager` from `@mikro-orm/core`,
explicit `userId`/args as parameters, `AllExceptionsFilter` for standard error shapes.
This story is also where the **first** carve-out from that filter happens - D22's bare-
JSON-string response on `exchange-rates/unit/:unit` - documented in story 4.3's Dev
Notes as "the handler writes the response directly ... via `@Res({ passthrough: false
})`, rather than throwing." Story 5.9 (metrics) is the other carve-out and follows the
same mechanism.

## Acceptance Criteria

### A. Redis provider

- [x] Add `ioredis` to `backend/package.json` dependencies (match the frontend's
      `^5.4.1` major, `frontend/package.json:48`).
- [x] `backend/src/redis/redis.module.ts` - `@Global() class RedisModule` (matching
      `ClockModule`'s `@Global()` precedent, story 4.2) providing `{ provide: REDIS,
      useFactory: () => new Redis({ host: 'redis', port: 6379 }) }` and exporting
      `REDIS`. `backend/src/redis/redis.ts` (or co-located) exports `export const REDIS
      = Symbol('REDIS')` - a `Symbol` token, matching `CLOCK`'s precedent (story 4.2), not
      a bare string. Host/port are hardcoded to match
      `frontend/src/server/redisClient.ts:3-6` and `docker-compose.yml`'s `redis`
      service (no auth, no TLS, single Compose network) - no new env var is needed; do
      not add one.
- [x] `AppModule` imports `RedisModule` **once, here**. Because it is `@Global()`
      (exactly like `ClockModule`), every later module injects `@Inject(REDIS) redis:
      Redis` directly with no `imports: [RedisModule]` of its own - stories 5.4 and 5.6
      take this as given and must not re-import or re-provide it.
- [x] Demonstrate the connection once with a temporary diagnostic (same add-exercise-
      remove convention as 3.4/4.1/4.2): inject `@Inject(REDIS) redis: Redis`, call
      `redis.ping()`, confirm `PONG`, paste the transcript into Dev Notes, then delete
      the diagnostic before finishing.

### B. `ExchangeRatesService`

- [x] `backend/src/exchange-rates/exchange-rates.service.ts` - `@Injectable()`, injects
      `EntityManager` and `@Inject(REDIS) redis: Redis`.
- [x] `refreshRates(): Promise<void>` - ports `frontend/src/server/helpers/get-exchange-rates.ts`'s
      `getExchangeRates`/`doUpdateExchangeRates` verbatim:
      - Redis key `exchange-rates-last-updated`, `SETEX` TTL 15s, checked before doing
        any work; if a value is already present, return immediately (no fetch).
      - An in-memory `inflightUpdate` promise so concurrent calls within this process
        await the same update rather than racing it (`get-exchange-rates.ts:15,70-88`) -
        this needs a module-scoped or instance field, not a per-call local, since the
        service is a singleton provider.
      - Fetch `https://api.coinbase.com/v2/exchange-rates` via `axios` (add `axios`
        to `backend/package.json`, matching the frontend's `^1.6.0`); invert each rate
        (`1 / rate`); keep only units the portfolio actually holds (`SELECT DISTINCT
        unit FROM PORTFOLIO.Transaction` - a raw query, or
        `em.getRepository(Transaction)` with a distinct projection).
      - Upsert each kept `{ unit, rate }` into `ExchangeRate` with one shared `nowDate`
        for the whole batch (the comment at `get-exchange-rates.ts:43-47` explains why:
        a per-row timestamp would let `MAX(date)` see a partially-updated set). Use
        `em.getConnection().execute()` for the `INSERT ... ON DUPLICATE KEY UPDATE`
        (D16 - this is exactly the raw-upsert-in-a-transaction shape D16 reserves for
        `execute()`), wrapped so all rows commit together or not at all.
- [x] Export `CACHE_EXPIRATION_BY_TIME_FRAME: Record<string, number>` from
      `backend/src/exchange-rates/exchange-rates.service.ts` (a module-level constant,
      not a class member), porting `get-exchange-rates.ts:92-105`'s table verbatim (`10
      * minute` for `h`, `1 * hour` for `d`, `1 * day` for `w`/`m`/`3m`/`6m`/`y`/`all`).
      **This is the one place the table is declared** - story 5.4's `POST
      /price-history/set` writes with the same TTLs and imports this constant rather
      than re-declaring it.
- [x] `getPriceHistoryForTimeFrame(coinName: string, timeFrame: string):
      Promise<PriceHistoryResponseDto>` - ports `get-exchange-rates.ts:108-131`:
      validate `timeFrame` is one of `TIME_FRAMES`
      (`backend/src/common/time-frame/time-frames.ts`) and `coinName` is a non-empty
      string, else throw (today's route lets an uncaught `Error('coinName and timeFrame
      are required')` 500 - reproduce that as an uncaught throw, not a `BadRequestException`,
      so `AllExceptionsFilter`'s generic `500 { error: 'Internal Server Error' }` path
      handles it exactly as today's unstructured 500 effectively does). Cache key
      `time-frame-pl-{timeFrame.toLowerCase()}-coinName-{coinName.toLowerCase()}`; on a
      Redis hit, `JSON.parse` and return; on a miss, throw (there is no live crypto.com
      fallback - it is commented out in the source, and story 2.1's inventory confirms
      no route re-enables it). This is the same cache the price-history domain (5.4)
      writes to via `POST /price-history/set` - do not invent a second key format.
- [x] `getRateForUnit(unit: string): Promise<ExchangeRate | null>` -
      `em.getRepository(ExchangeRate).findOne({ unit })` (the `unit` column carries a
      unique constraint - `ExchangeRate_unit_key`,
      `backend/src/db/entities/exchange-rate.entity.ts:26` - so there is at most one row
      per unit and no ordering ambiguity to worry about, unlike a plain `findFirst`).
- [x] `ExchangeRatesModule` registers `ExchangeRatesService` in `providers` and adds it
      to `exports`.

### C. Controller wiring

- [x] `exchange-rates.controller.ts`'s `getPriceHistory` calls
      `exchangeRatesService.getPriceHistoryForTimeFrame(coinName, timeFrame)` and
      returns it directly (public, no guard - matches the existing stub).
- [x] `getByUnit` calls `exchangeRatesService.refreshRates()` then
      `exchangeRatesService.getRateForUnit(unit)`. **This is the D22 carve-out**: inject
      `@Res({ passthrough: false }) res: Response` (from `express`) and write the
      response directly - `res.status(200).json(formatUSD(rate.rate))` on a hit,
      `res.status(404).json('Exchange rate not found')` on a miss. Do not throw
      `NotFoundException` for the miss case - `AllExceptionsFilter` would reshape it to
      `{ error: 'Exchange rate not found' }`, an object, not the bare string FR-3 pins.
      Change the method's return type to `Promise<void>` since the response is now
      written manually; update the `@ApiResponse` schemas if they need adjusting to stay
      accurate (they already document a bare string per story 2.7 - confirm, don't just
      trust, since the return type change is new).
- [x] `formatUSD` (architecture D18, story 5.7's job to formally introduce both
      formatters) is needed here too, one story early. Add
      `backend/src/common/formatting/format-usd.ts` now, exporting `formatUSD(value:
      number, wrapIfNegative = false): string`, porting
      `frontend/src/server/helpers/format-usd.ts` verbatim (branches on `Math.abs(value)
      < 10`: below uses `maximumFractionDigits: 2`, at/above uses
      `maximumFractionDigits: 0`; `wrapIfNegative` parenthesizes negatives). This is a
      **plain exported function, not a provider** (architecture D17 - NFR-1's DI
      requirement targets ambient/stateful collaborators, not a pure function). Story
      5.7 adds the sibling `formatUsdPrecise` next to it and is the one that documents
      the two-formatter decision in full (D18/F2) - this story only needs the one
      function it already depends on.

### D. Parity and regression

- [x] NFR-4: `GET /exchange-rates/{timeFrame}/{coinName}` for a coin/timeFrame combo
      already cached via the legacy stack (or seed the cache first with a `price-history/set`-
      equivalent write) against both origins; confirm identical `prices`/`price_change`/
      `usd_price_change`. `GET /exchange-rates/unit/{unit}` for a known unit against both
      origins - confirm the same bare-string `200`, and confirm both return the bare-
      string `404` for an unknown unit.
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.

## Technical Notes

### Entities

`backend/src/db/entities/exchange-rate.entity.ts` - `ExchangeRate` (`id`, `date &
Opt`, `unit` unique, `rate: number`). `backend/src/db/entities/transaction.entity.ts`
for the distinct-units-held query.

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s
`exchange-rates/[timeFrame]/[coinName]` and `exchange-rates/unit/[unit]` sections. Live
source: `frontend/src/server/helpers/get-exchange-rates.ts`,
`frontend/src/app/api/exchange-rates/[timeFrame]/[coinName]/route.ts`,
`frontend/src/app/api/exchange-rates/unit/[unit]/route.ts`.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
# redis.ping() diagnostic transcript, then remove it
# functional + parity checks per AC D, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- `getPriceHistoryForTimeFrame`'s consumers in other domains (token-info's sync - 5.3;
  summary's profitLossChart - 5.6; both time-frame P/L endpoints - 5.8) - each imports
  `ExchangeRatesModule` and calls this story's service; none of them re-implement it.
- `formatUsdPrecise` and the full two-formatter writeup - story 5.7.
- Any raw aggregate query outside the exchange-rate upsert - stories 5.5/5.6/5.8.

## Dev Notes

### Redis diagnostic transcript (AC A, removed after confirming)

A temporary `OnModuleInit` was added to `ExchangeRatesService` injecting `@Inject(REDIS)
redis: Redis` and logging the result of `redis.ping()`, then rebuilt via `docker compose
up -d --build nest-api`. `docker logs nest-api` showed:

```
{"context":"InstanceLoader","message":"RedisModule dependencies initialized", ...}
{"context":"ExchangeRatesService","message":"REDIS DIAGNOSTIC PING: PONG", ...}
```

Confirmed `PONG`, then the `OnModuleInit` block and its imports were removed from
`exchange-rates.service.ts` before finishing (confirmed by re-reading the file and by
`typecheck`/`lint`/`build` passing clean afterward).

### D22 carve-out: what happens if `refreshRates()` throws before any write

`getByUnit` injects `@Res({ passthrough: false })` and calls `refreshRates()` (network +
DB) before either of the two direct writes (`res.status(200).json(...)` /
`res.status(404).json(...)`). Neither `await` is wrapped in a try/catch. This is
deliberate, not an oversight:

`@Res({ passthrough: false })` only suppresses Nest's *automatic* handling of a
handler's **return value** - it does not disable the exception-filter pipeline for a
**thrown** error. If `refreshRates()` rejects (Coinbase unreachable, a bad upsert, etc.),
the async handler's promise rejects before either `res.status(...)` line ever runs, so
nothing has been written to the response yet. Nest's router execution context still
routes that rejection to `AllExceptionsFilter`, which calls `response.status(500).json({
error: 'Internal Server Error' })` on the same untouched `res` object - there is no
double-write / "headers already sent" hazard, because the carve-out's manual writes and
the filter's manual write are mutually exclusive by construction (the filter only runs
when the manual write never happened).

This also matches today's behavior: `frontend/src/app/api/exchange-rates/unit/[unit]/route.ts`
calls `await getExchangeRates()` with no try/catch either, so a throw there today falls
through to Next's own unstructured 500 - confirmed live (see parity evidence below, "NEW
invalid timeframe" / "NEW miss" cases on the sibling endpoint show the same 500 shape on
both origins). Wrapping `refreshRates()` in a try/catch here to hand-roll a 500 would be
an unrequested defensive addition with no behavioral difference from letting it propagate.

### Bug found and fixed: route-matching order made `getByUnit` unreachable

The Epic 2 stub controller declared `@Get(':timeFrame/:coinName')` before
`@Get('unit/:unit')`. Nest (via Express) matches routes in declaration order, so a
request to `GET /exchange-rates/unit/BTC` matched the first route with `timeFrame='unit'`,
`coinName='BTC'` and never reached `getByUnit` at all. This was invisible under Epic 2
because both handlers threw `NotImplementedException` regardless of which one ran; this
story is the first to exercise real behavior and the first place the bug could surface.
Confirmed live: before the fix, `GET .../exchange-rates/unit/BTC` returned `500
{"error":"Internal Server Error"}` (from `getPriceHistoryForTimeFrame('BTC', 'unit')`
throwing on the invalid `timeFrame`), not the 200/404 `getByUnit` was supposed to
produce. Fixed by reordering the controller's methods so `unit/:unit` (a literal
segment) is registered ahead of the wildcard `:timeFrame/:coinName` -
`backend/src/exchange-rates/exchange-rates.controller.ts`. Re-verified after the fix (see
parity evidence below) - this is a fix to this story's own AC-C wiring, not a
pre-existing-and-out-of-scope issue, since the stub controller shipped with no behavior
to break until this story added it.

### `SELECT DISTINCT unit` and the upsert both use `em.getConnection().execute()`

AC-B offered either a raw query or `em.getRepository(Transaction)` with a distinct
projection for the held-units lookup. Went with the raw form
(`exchange-rates.service.ts:73-76`) to match `get-exchange-rates.ts`'s literal
`PORTFOLIO.Transaction`-qualified SQL verbatim and because MikroORM 7's core
`Connection.execute<T>()` signature is `Promise<QueryResult<T> | any | any[]>` - the
bare `any` in that union collapses the resolved type to `any` regardless of the `<T>`
argument, so an explicit cast (`as { unit: string }[]`) was needed either way; there was
no accuracy advantage to a QueryBuilder distinct-projection over the raw form here.

For the upsert, `em.transactional(async (em) => { ... em.getConnection().execute(sql,
params, 'run', em.getTransactionContext()) ... })` was used - confirmed via
`TransactionManager.processTransaction` (`@mikro-orm/core/utils/TransactionManager.js:236-243`)
that the forked `em` passed into the callback has `setTransactionContext(trx)` called on
it *before* the callback runs, so `em.getTransactionContext()` inside the callback
returns the live transaction handle to pass as `execute()`'s `ctx` argument, keeping all
rows in the same commit-or-rollback unit as AC-B requires.

### Verification evidence (AC D)

Live data was already present from the legacy stack's own scheduled refresh (`portfolio-db`
had populated `ExchangeRate` and Redis already held live `time-frame-pl-*` cache keys),
so no seeding was needed for either check.

**`GET /exchange-rates/unit/:unit`** (old `/api/...` vs. new `/backend/api/...`, same
`www.tubesock.xyz` origin):

- `unit/BTC`: both `200`, both body `"$79,004"` (byte-identical), old `content-type:
  application/json`, new `content-type: application/json; charset=utf-8` (same family,
  matches story 5.1's precedent for this difference).
- `unit/NOPE` (unknown unit): both `404`, both body `"Exchange rate not found"`.
- Confirmed `refreshRates()` genuinely refetches: after `DEL
  exchange-rates-last-updated` in Redis, one request updated `ExchangeRate.BTC.date` to
  the request's own timestamp and set the 15s TTL key; an immediate second request left
  `ExchangeRate.BTC.date` unchanged (cache-window skip verified against the DB row, not
  just the Redis key).

**`GET /exchange-rates/:timeFrame/:coinName`** (using an existing cached
`time-frame-pl-d-coinName-bitcoin` key):

- `d/bitcoin`: both `200`, response bodies byte-identical (`price_change`, `prices`
  array, `usd_price_change` all matched exactly across both origins - diffed the full
  JSON payloads).
- `d/nonexistentcoinxyz` (cache miss): both `500`; new body `{"error":"Internal Server
  Error"}` (`AllExceptionsFilter`'s generic path), old origin returns `500` with no
  JSON body (Next's own unstructured error page) - status codes match, which is what the
  AC's "today's unstructured 500 effectively does" language calls for.
- `bogus/bitcoin` (invalid `timeFrame`): both `500`, same shape as the cache-miss case
  above (the uncaught `Error('coinName and timeFrame are required')` path).

**Epic review round 1 correction:** `doUpdateExchangeRates`'s shared-batch-timestamp read
a bare `new Date()` instead of the injected clock, which is exactly the ambient-time
access story 4.2's `CLOCK` token exists to prevent (`grep -rn 'new Date()\|Date.now()\|
dayjs()' backend/src` should return nothing outside `system-clock.ts`, and this line was
a hit). `ExchangeRatesService` now injects `@Inject(CLOCK) clock: Clock` and reads
`this.clock.now()`. No behavior change - `SystemClock.now()` also returns `new Date()` -
this only matters for testability and for the standing grep check.

### Changed Files

+ backend/src/redis/redis.ts                                  `export const REDIS = Symbol('REDIS')` - the injection token, matching `CLOCK`'s precedent
+ backend/src/redis/redis.module.ts                            `@Global() RedisModule` providing a single hardcoded `ioredis` client under `REDIS`, exported for every later module to inject directly
+ backend/src/common/formatting/format-usd.ts                  `formatUSD(value, wrapIfNegative)` - plain exported function (D17), verbatim port of `frontend/src/server/helpers/format-usd.ts`
+ backend/src/exchange-rates/exchange-rates.service.ts          `ExchangeRatesService` - `refreshRates()` (Redis-gated Coinbase refetch + raw upsert), `CACHE_EXPIRATION_BY_TIME_FRAME`, `getPriceHistoryForTimeFrame()`, `getRateForUnit()`
~ backend/src/exchange-rates/exchange-rates.controller.ts       wires `ExchangeRatesService` into both handlers; `getByUnit` becomes the D22 bare-string carve-out via `@Res({ passthrough: false })`; methods reordered (`unit/:unit` before `:timeFrame/:coinName`) to fix a route-matching bug that made `getByUnit` unreachable
~ backend/src/exchange-rates/exchange-rates.module.ts           registers and exports `ExchangeRatesService`
~ backend/src/app.module.ts                                     imports `RedisModule` once (global, per `ClockModule`'s precedent)
~ backend/package.json                                          adds `ioredis` (`^5.4.1`) and `axios` (`^1.6.0`) dependencies
~ pnpm-lock.yaml                                                 lockfile update for the two new dependencies
~ frontend/src/api/generated.ts                                  regenerated via Orval; pure reordering of the two exchange-rates function blocks (no signature/shape change) reflecting the controller method reorder above

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts` (present since story
  4.1, untouched by this story).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `docker compose up -d --build nest-api` (twice - once for the Redis diagnostic, once
  after the route-order fix), then `docker compose up -d --build` (full stack) - all
  built and came up cleanly; `curl -sk https://www.tubesock.xyz/backend/api/health
  --resolve www.tubesock.xyz:443:127.0.0.1` returned `200 {"status":"ok"}` after the
  final rebuild.
- Redis diagnostic (AC A) - see "Redis diagnostic transcript" above: `PONG` confirmed,
  diagnostic code removed afterward.
- Functional and NFR-4 parity checks against the running stack - see "Verification
  evidence (AC D)" above for the full request/response comparisons, including the
  route-order bug found and fixed along the way.
- `docker exec next-app pnpm --filter @portfolio/frontend spec:generate` (against the
  rebuilt `nest-api`) - `git status --porcelain frontend/src/api/generated.ts` printed a
  change; `git diff --stat` showed 111 insertions / 111 deletions, and a full read of the
  diff confirmed it is exactly the two exchange-rates function blocks (`coinPriceHistory`
  / `exchangeRatesByUnit` and their query-option/hook siblings) swapping position with no
  change to any name, signature, or type - a direct, expected consequence of reordering
  the controller's route handlers. Left staged for the driver to commit alongside this
  story's other changed files.
