# Epic 5: Domain endpoint implementation

Status: Complete

Stories: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10
Depends on: 4, 9, 10
Base commit: 0c41f7dd0e86d88b03b6166af032ba052075e2b4

## Scope

Replace every remaining Epic 2 scaffold stub (`throw new NotImplementedException()`)
with real behavior, domain by domain, decomposing `frontend/src/server/db/dbService.ts`
and `frontend/src/server/helpers/*.ts` into per-domain injectable Nest services (FR-15)
rather than one god service. All 18 non-auth data endpoints from FR-1 are covered
(`transaction/*`, `summary/*`, `stats/:unit`, `product/:product`, `exchange-rates/*`,
`price-history/*`, `time-frame-*-pl/:timeFrame`, `token-info/*`, `metrics`) plus the
Redis provider and the `TimeFrameService`/`ExchangeRatesService` cross-domain
dependencies those endpoints need. Every DTO, controller, and module already exists
from Epic 2 and is Swagger-documented against the finished contract - this epic wires
real logic behind it, not new API surface.

Every story ends with an NFR-4 parity comparison (old Next.js route vs. new NestJS
route, same user, same inputs, diffed and pasted into the story) and, where a DTO's
shape changes, a regenerated and committed `frontend/src/api/generated.ts` (FR-26).
`frontend/src/app/api/` and `frontend/src/server/` are read for reference only and are
never edited (GR-1) - `dbService.ts` and the helpers keep running unchanged behind the
old routes for the whole initiative.

## Changed Files

10 stories, 44 files.

+ backend/src/common/formatting/format-usd.ts   `formatUSD` (5.2), plus `formatUsdPrecise` (5.7) - D18/F2's second, deliberately distinct USD formatter, with the two-line divergence comment
+ backend/src/common/interceptors/http-metrics.interceptor.ts   global interceptor recording method/path/status/duration for every request via `response.on('finish')` (5.9)
+ backend/src/common/time-frame/time-frame.module.ts   exports `TimeFrameService` (5.8)
+ backend/src/common/time-frame/time-frame.service.ts   `TimeFrameService`: `TimeFrame -> Date` via injected `CLOCK` + native `Date` arithmetic (5.8)
+ backend/src/exchange-rates/exchange-rates.service.ts   `ExchangeRatesService` - `refreshRates()` (Redis-gated Coinbase refetch + raw upsert), `CACHE_EXPIRATION_BY_TIME_FRAME`, `getPriceHistoryForTimeFrame()`, `getRateForUnit()` (5.2); `external_api_calls_total` and `redis_cache_results_total` wiring (5.9)
+ backend/src/metrics/metrics.service.ts   `Registry` plus the four D31 metrics, mirroring `frontend/src/server/metrics.ts` without the hot-reload `globalThis` guard (5.9)
+ backend/src/price-history/price-history.service.ts   `checkCoverage`/`setEntry` real logic behind the two stub endpoints (5.4); `redis_cache_results_total` wiring (5.9)
+ backend/src/product/product.service.ts   `ProductService.getTransactionsForProduct` - empty-product short-circuit, `unit`-filtered `em.find`, ported `calculateFIFOGains`/`formatTransactions` using `formatUsdPrecise` (5.7)
+ backend/src/redis/redis.module.ts   `@Global() RedisModule` providing a single hardcoded `ioredis` client under `REDIS`, exported for every later module to inject directly (5.2)
+ backend/src/redis/redis.ts   `export const REDIS = Symbol('REDIS')` - the injection token, matching `CLOCK`'s precedent (5.2)
+ backend/src/stats/stats.service.ts   `StatsService.getStatsForUnit` - `refreshRates()` then `SummaryService.getCoinSummaries(userId, unit)`, `formatUSD`-formats every field, returns `formatted[0]` (5.7)
+ backend/src/summary/summary.service.ts   `getCoinSummaries`/`getPortfolioSummary`/`getBuySellTotalFiFo` aggregate queries, FIFO net-cash-flow helpers, `getCoins`/`getPortfolio` (5.5); `getCoinsByUnit`, the ported `getPriceHistoryMap`/`getNetCashFlowHistory` FIFO chart walk, and the Redis-cached `getProfitLossChart` wrapper (5.6); `redis_cache_results_total` wiring (5.9)
+ backend/src/time-frame-pl/time-frame-coins-pl.service.ts   per-coin past/current P/L, ports `time-frame-coins-pl/[timeFrame]/route.ts:30-57` (5.8)
+ backend/src/time-frame-pl/time-frame-total-pl.service.ts   aggregate past/current P/L, ports `time-frame-total-pl/[timeFrame]/route.ts:14-36` (5.8)
+ backend/src/token-info/token-info.service.ts   `getTokensForUserId` (public, raw join), `searchTokenInfo`, `syncPriceHistoryForUser` (per-token price-history fetch + `INSERT IGNORE` bulk write, reproducing the `openPrice`-as-`closePrice` field-mapping bug verbatim) (5.3)
+ backend/src/transactions/transactions.service.ts   `addTransaction`/`deleteTransaction`, `EntityManager`-injected, reproduces the legacy route logic exactly (validation, sign convention, field mapping, no-ownership-check delete folding a miss into the same 500) (5.1)
~ backend/package.json   adds `ioredis ^5.4.1` and `axios ^1.6.0` (5.2), `dayjs ^1.11.10` (5.3), `prom-client ^15.1.3` (5.9)
~ backend/src/app.module.ts   imports `RedisModule` once (global, per `ClockModule`'s precedent) (5.2)
~ backend/src/exchange-rates/dto/price-history-response.dto.ts   adds `@IsOptional()` + a type validator to all three fields, fixing the `whitelist: true` stripping of the nested `priceHistoryResp` body on `POST /price-history/set` (corrects 5.4's AC, found by 5.8) (5.10)
~ backend/src/exchange-rates/exchange-rates.controller.ts   wires the service into both handlers; `getByUnit` becomes the D22 bare-string carve-out via `@Res({ passthrough: false })`; methods reordered (`unit/:unit` before `:timeFrame/:coinName`) to fix a route-matching bug that made `getByUnit` unreachable (5.2)
~ backend/src/exchange-rates/exchange-rates.module.ts   registers and exports `ExchangeRatesService` (5.2)
~ backend/src/main.ts   registers `HttpMetricsInterceptor` via `app.useGlobalInterceptors(...)` (5.9)
~ backend/src/metrics/metrics.controller.ts   real handler: `@Res({ passthrough: false })` D22 carve-out, bearer-token check against `AppConfigService.metricsSecret`, plain-text `403`/Prometheus-text `200` (5.9)
~ backend/src/metrics/metrics.module.ts   `@Global()`, registers/exports `MetricsService` so other domains and the global interceptor can inject it without an explicit module import (5.9)
~ backend/src/price-history/dto/set-price-history-response.dto.ts   corrected the `message` example to the real interpolated format (5.4)
~ backend/src/price-history/price-history.controller.ts   wires the service in; `@HttpCode(200)` on `set` to match the old route's status (5.4)
~ backend/src/price-history/price-history.module.ts   registers `PriceHistoryService` as a provider (5.4)
~ backend/src/product/product.controller.ts   `getByProduct` calls `ProductService` instead of throwing; comment updated to name `formatUsdPrecise` (5.7)
~ backend/src/product/product.module.ts   registers `ProductService` (5.7)
~ backend/src/stats/stats.controller.ts   `getByUnit` calls `StatsService.getStatsForUnit` instead of throwing; description now notes the empty-200 no-match case (5.7)
~ backend/src/stats/stats.module.ts   imports `SummaryModule`/`ExchangeRatesModule`, registers `StatsService` (5.7)
~ backend/src/summary/summary.controller.ts   `getCoins`/`getPortfolio` (5.5), then `getByUnit`/`getProfitLossChartByQuery`/`getProfitLossChartByParam` (5.6) call the real service instead of throwing
~ backend/src/summary/summary.module.ts   registers/exports `SummaryService`, imports `ExchangeRatesModule` (5.5) and `TokenInfoModule` (5.6)
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts   wires `TimeFrameCoinsPlService.getCoinsPl` in place of the stub (5.8)
~ backend/src/time-frame-pl/time-frame-pl.module.ts   registers both services; imports `SummaryModule`, `ExchangeRatesModule`, `TimeFrameModule` (5.8)
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts   wires `TimeFrameTotalPlService.getTotalPl` in place of the stub (5.8)
~ backend/src/token-info/token-info.controller.ts   wires `TokenInfoService` into `sync` (userId parse/falsy 400, id/session-mismatch 403) and `search` (empty-term 400); adds the 403 Swagger response (5.3)
~ backend/src/token-info/token-info.module.ts   imports `ExchangeRatesModule`, registers and exports `TokenInfoService` (5.3)
~ backend/src/transactions/dto/transaction-add-request.dto.ts   drops `side`'s `@IsIn(['BUY','SELL'])` (was pre-empting the service's own `Invalid side` check with class-validator's own message/shape), adds `@IsString()` (5.1)
~ backend/src/transactions/transactions.controller.ts   wires `TransactionsService`; `add` gets `@HttpCode(200)` + `@Header('Content-Type','application/json')` and returns `JSON.stringify(...)` so the reply matches the old route's JSON-string body and status instead of Nest's default `text/html`/`201` (5.1)
~ backend/src/transactions/transactions.module.ts   registers `TransactionsService` in `providers` (5.1)
~ frontend/src/api/generated.ts   regenerated across 5.2/5.3/5.5/5.6/5.7; the only content change is `TokenInfoSync403` added to `tokenInfoSync`'s error union (5.3) and `statsByUnit`'s JSDoc description (5.7) - the rest is block reordering from Nest module-instantiation order changes
~ monitoring/prometheus.yml   adds the `nestjs-backend` scrape config (`nest-api:3001`, `/backend/api/metrics`, same bearer credential shape as `nextjs-app`) (5.9)
~ pnpm-lock.yaml   lockfile entries for `ioredis`, `axios`, `dayjs`, `prom-client`

## Review Notes

### Round 1

Depth: `backend/src/summary/**` · `product/**` · `stats/**` · `time-frame-pl/**` ·
`transactions/**` deep (money/data integrity, live consumers) · `token-info/**` ·
`price-history/**` · `exchange-rates/**` · `metrics/**` deep (trust boundaries: two
unauthenticated write paths, a bearer-token check, a new ownership check) ·
`frontend/src/api/generated.ts` and `pnpm-lock.yaml` skim (generated) · module wiring,
`backend/package.json`, `monitoring/prometheus.yml` standard.

Confirmed independently, no finding raised: `@Res({ passthrough: false })` is exactly
two call sites (`exchange-rates.controller.ts:46`, `metrics.controller.ts:41`); the
`@Body()`-bound DTO audit is complete (three call sites, one nested DTO, every field now
carries a class-validator decorator); the `generated.ts` diff is a pure reorder apart
from `TokenInfoSync403` and `statsByUnit`'s JSDoc (verified by diffing the sorted old and
new files); the deliberately reproduced legacy bugs are faithful and recorded
(`openPrice`-as-`closePrice` in `token-info.service.ts:81-84` and `summary.service.ts`'s
`getPriceHistoryMap`, `unit`-not-`product` filtering in `product.service.ts`, no
`getExchangeRates()` on `time-frame-coins-pl`); no duplicated aggregate query - 5.5-5.8
consume `SummaryService`/`ExchangeRatesService`/`TokenInfoService.getTokensForUserId` as
required; `tx.side?.toUpperCase()` -> `===` is safe (all 236 live rows are `BUY`/`SELL`
upper case, none has a null `token_info_id`).

- **F1** [blocking · correctness] `backend/src/common/time-frame/time-frame.service.ts:22,25,26,28`
  - `dayjs.subtract` clamps to the end of the shorter month where the legacy route's
  `Date` mutation overflows, so `m`/`3m`/`6m`/`y` resolve to a different cutoff on
  month-end dates.
  `time-frame-coins-pl/[timeFrame]/route.ts:10-18` mutates a `Date`
  (`now.setMonth(now.getMonth() - 1)`), which overflows an out-of-range day into the
  following month; `dayjs(...).subtract(1, 'month')` clamps it instead. Measured with the
  container's own `dayjs`:
  ```
  2026-03-31  m : legacy 2026-03-03  new 2026-02-28
  2026-05-31  m : legacy 2026-05-01  new 2026-04-30
  2026-05-31  3m: legacy 2026-03-03  new 2026-02-28
  2024-02-29  y : legacy 2023-03-01  new 2023-02-28
  ```
  That date is the `onDate` cutoff passed to `getCoinSummaries` for the past snapshot, so
  on the 29th-31st of a month any transaction inside the (up to 28-day) gap moves
  `pastPl` in `GET /time-frame-coins-pl/:timeFrame`. Story 5.8's AC A says both "ports
  route.ts:7-21's switch exactly" and "use `dayjs` arithmetic"; those conflict here and
  the parity requirement is the binding one. Reproduce the overflow semantics while still
  seeding from `CLOCK` (`const d = new Date(this.clock.now()); d.setMonth(d.getMonth() - 1)`
  keeps the injected clock), or - if the clamping behavior is preferred - record it in
  5.8's Dev Notes as a deliberate divergence so it stops reading as byte-parity.
  - Status: Fixed
  - `time-frame.service.ts:14-45` rewritten to seed a native `Date` from
    `this.clock.now()` and mutate it with `setHours`/`setDate`/`setMonth`/`setFullYear`,
    reproducing the legacy overflow semantics exactly. Verified against all four dates
    in the finding's table (`2026-03-31 m`, `2026-05-31 m`, `2026-05-31 3m`,
    `2024-02-29 y`) with a standalone script running the same logic inside the
    `nest-api` container - all four now match the "legacy" column exactly. `dayjs` is no
    longer imported by this file. Story 5.8's Dev Notes updated with the correction.

- **F2** [blocking · correctness] `backend/src/exchange-rates/exchange-rates.service.ts:87`
  - a bare `new Date()` outside `system-clock.ts` breaks NFR-1 and story 4.2's standing
  grep check, and story 5.8 recorded that check as passing while its own pasted output
  shows the hit.
  ```ts
  const nowDate = new Date();
  ```
  `grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src` now returns this line in
  addition to `common/clock/system-clock.ts:9`. Story 4.2 AC C defines that grep
  returning nothing outside `system-clock.ts` as "the check every later story can re-run
  to confirm it still holds", and story 5.8 AC E marks it `[x]` while its Dev Notes list
  this same line as a hit (calling it "pre-existing" - it is pre-existing to 5.8, but it
  is introduced by this epic's own diff, in story 5.2). `ExchangeRatesService` already
  takes three constructor dependencies; inject `@Inject(CLOCK) clock: Clock` and use
  `this.clock.now()`, and correct 5.8's AC E line.
  - Status: Fixed
  - `exchange-rates.service.ts` now injects `@Inject(CLOCK) private readonly clock:
    Clock` in the constructor, and `doUpdateExchangeRates` reads `this.clock.now()`
    (`exchange-rates.service.ts:89`) instead of `new Date()`. Verified:
    `grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src` now returns only
    `system-clock.ts:4,9` (the permitted case) and an unrelated comment in
    `auth/session.service.ts:49`. Story 5.8's and story 5.2's Dev Notes both corrected.

- **F3** [blocking · correctness] `backend/src/summary/summary.service.ts:181` - the
  accepted `Transaction.size` float divergence is bounded by MySQL's 6-significant-digit
  FLOAT text rendering, not by `~1e-8`, so it is not guaranteed invisible at two decimals
  the way story 5.10's answer concludes.
  ```ts
  const rows = await this.em.find(
    Transaction,
    { userId, ...(unit && { unit }) },
    { orderBy: { date: 'asc' } },
  );
  ```
  Legacy `getBuySellTotalFiFo` (`dbService.ts:139-147`) selects `ABS(total)`/`ABS(size)`,
  which MySQL evaluates as DOUBLE and returns at full precision; this reads the raw
  `FLOAT` columns through MikroORM, which goes through mysql2's **text** protocol.
  Measured in the `nest-api` container against `portfolio-db`:
  ```
  query(text):   [{f:21005.4},{f:0.3},{f:0.7},{f:123457}]
  execute(bin):  [{f:21005.369140625},{f:0.30000001192092896},{f:0.699999988079071},{f:123456.78125}]
  ```
  (text protocol is what produced the `0.3` that story 5.6 observed from `em.find`.) So a
  `total` of `21005.37` reads back as `21005.4` here and as `21005.369140625` on the old
  route - a 3-cent, plainly visible difference in `netContributions`/`netCashHoldings`/
  `accountValue`/`realizedReturn`/`roi` and in every `netRows` entry, not a sub-cent one.
  It has not shown up in any parity run because the live data has no such value:
  `SELECT COUNT(*) ... WHERE` the text rendering differs from the exact value returns `0`
  of 236 rows (max `|total|` is `15252`, every value fits in 6 significant digits). One
  transaction of `$10,000.01` or a size with 7 significant digits changes that.
  Two supporting errors in 5.10's trace: `runningBalance` is **not** "sourced from the
  unaffected raw-query path" - it comes from this same `em.find` path via
  `ProductService`, and only survives because of `.toFixed(4)`; and the trace omits
  `summary/coins`'s and `summary/portfolio`'s net-cash fields, which are equally
  downstream of `getBuySellTotalFiFo` (they do render at two decimals -
  `SingleStat.tsx:289,304`, `BreakDown.tsx:21-31` - so the conclusion survives for them,
  but they were not checked). Either read these two columns through the legacy's own
  `ABS()`-widening raw SELECT so the values match exactly, or re-record the real bound in
  5.6/5.10 with a seeded 7-significant-digit row as evidence, so the owner accepts the
  actual risk rather than the stated one.
  - Status: Fixed
  - `getBuySellTotalFiFo` (`summary.service.ts:184-212`) rewritten to read `total`/`size`
    via a raw `SELECT ... ABS(total) AS total, ABS(size) AS size ...` through
    `em.getConnection().execute()`, matching `dbService.ts:139-147` exactly, instead of
    `em.find(Transaction, ...)`. Closes the gap for every consumer
    (`getCoins`/`getCoinsByUnit`/`getPortfolio`'s net-cash fields,
    `getProfitLossChart`'s `netRows`), not just the two fields named in the finding.
    Verified live end-to-end: seeded a `Transaction.total` of `-1234567.5` (7 significant
    digits) for a temp user, confirmed the unfixed read path (`em.find`-equivalent,
    mysql2 text protocol) returns `-1234570` while a direct `ABS()`-wrapped read of the
    same row returns `1234567.5`, then confirmed `GET /summary/portfolio` on the rebuilt
    `nest-api` returns `netContributions: 1234567.5` (exact) - temp data removed after.
    Story 5.5's Dev Notes corrected with the real bound and the fix; story 5.10's Dev
    Notes corrected (`runningBalance`'s actual source, the omitted `summary/coins`/
    `summary/portfolio` fields, and the `~1e-8` framing); story 5.6's Dev Notes annotated
    pointing at the fix. `ProductService.getTransactionsForProduct`'s own
    `em.find(Transaction, ...)` (used for `runningBalance`/`realizedGains`) is a separate
    call site with the same theoretical exposure, left unfixed as out of this finding's
    scope (it names `summary.service.ts:181` specifically) - noted as a candidate
    follow-up in 5.10's Dev Notes.

- **F4** [blocking · conventions] planning-document decision codes appear in nine code
  comments across seven files - `backend/src/summary/summary.service.ts:76`
  ```ts
  // Ported verbatim from dbService.ts's getCoinSummaries per D16 - the aggregate/
  ```
  Also `summary.service.ts:137,178`, `common/formatting/format-usd.ts:22`,
  `product/product.controller.ts:27`, `exchange-rates/exchange-rates.controller.ts:38`,
  `metrics/metrics.controller.ts:35`, `metrics/metrics.service.ts:4`,
  `token-info/token-info.service.ts:90` (`D16`, `D18/F2`, `D22`, `D31`). The repo's
  standing instruction is "Never cite IDs from planning docs (story/epic numbers,
  tickets, 'FR-3', decision codes) anywhere in code, commits, or API-visible text; put
  the reasoning itself in the comment" - and this is recorded owner feedback from an
  earlier round, not a fresh preference. Every one of these comments already states its
  reasoning; delete the code and keep the sentence. All nine lines are introduced by this
  diff (the same grep over the rest of `backend/src` returns nothing).
  - Status: Fixed
  - Removed the decision-code citation from all nine comments, keeping each one's
    existing reasoning sentence: `summary.service.ts:75,136` (the D16 mentions - one of
    the two, at what was line 178, was already rewritten by the F3 fix), `format-usd.ts:22`,
    `product/product.controller.ts:27`, `exchange-rates/exchange-rates.controller.ts:38`,
    `metrics/metrics.controller.ts:35`, `metrics/metrics.service.ts:4`,
    `token-info/token-info.service.ts:90`. Verified:
    `grep -rn 'D1[0-9]\|D2[0-9]\|D3[0-9]\|FR-[0-9]\|GR-[0-9]\|NFR-[0-9]' backend/src`
    returns nothing.

- **F5** [advisory · correctness] `backend/src/summary/summary.controller.ts:70` - an
  explicitly empty `timeFrame` query param 500s where the old route returns the `all`
  chart.
  ```ts
  @Query('timeFrame') timeFrame = 'all',
  ```
  A TypeScript default only applies to `undefined`, so `GET /summary/profitLossChart?timeFrame=`
  passes `''` through to `getPriceHistoryForTimeFrame`, whose `!timeFrame` guard throws
  (`500 { error: 'Internal Server Error' }`). `summary/profitLossChart/route.ts:29` uses
  `searchParams.get('timeFrame') || 'all'`, which treats the empty string as absent and
  returns `200`. No known caller sends an empty value; `timeFrame || 'all'` in the
  handler closes it.
  - Status: Fixed
  - Agreed this is worth closing rather than leaving live: changed the parameter to
    `timeFrame?: string` and the call site to `timeFrame || 'all'`
    (`summary.controller.ts:70,72`). Verified live:
    `GET /summary/profitLossChart?timeFrame=` now returns
    `200 {"netRows":[],"lowestPointIndex":0,"highestPointIndex":0}`. Story 5.6's Dev
    Notes updated.

- **F6** [advisory · conventions] `backend/src/transactions/transactions.controller.ts:95`
  - the deliberately preserved missing ownership check on delete is now unmarked in code.
  ```ts
  await this.transactionsService.deleteTransaction(parseInt(id, 10));
  ```
  `deleteTransaction(id)` takes no `userId`, so any authenticated caller can delete any
  user's row by id. That is correct per FR-3 and story 5.1, but the stub's comment that
  partly flagged it ("matches the existing behavior of not checking whether the row
  exists first") was removed in this diff and nothing replaced it - the service's
  remaining comment covers only the miss-folds-into-500 behavior. This is the one
  preserved legacy bug with a security consequence, and it is the one most likely to be
  "fixed" or overlooked by a later reader. One line noting that the missing ownership
  scoping is intentional (without citing a story or FR id, per F4) would carry it.
  - Status: Fixed
  - Added a one-line comment directly above the call
  (`transactions.controller.ts:95-96`): "Deliberately not scoped to `user.sub`: any
  authenticated caller can delete any user's row by id, matching the existing route's
  behavior. Not a fix target." No behavior change. Story 5.1's Dev Notes updated.

### Round 2

Depth: `backend/src/summary/summary.service.ts` (`getBuySellTotalFiFo`) and
`common/time-frame/time-frame.service.ts` deep (money path, changed after all per-story
parity evidence was gathered) · `summary/summary.controller.ts`,
`exchange-rates/exchange-rates.service.ts` standard · the seven comment-only edits
(`format-usd.ts`, `metrics/*`, `product.controller.ts`, `token-info.service.ts`,
`transactions.controller.ts`, `exchange-rates.controller.ts`) skim · Dev Notes
corrections in 5.1/5.2/5.5/5.6/5.8/5.10 standard.

Constraints re-confirmed after the fixes: `@Res({ passthrough: false })` is still exactly
two call sites (`exchange-rates.controller.ts:46`, `metrics.controller.ts:41`; auth's two
are `passthrough: true` and predate this epic); `git diff --name-only` against the base
touches nothing under `frontend/src/app/api/` or `frontend/src/server/`;
`frontend/src/api/generated.ts` is consistent with the current DTOs - regenerated the
client from the running `nest-api`'s live OpenAPI document into a scratch file and
compared, giving an identical 175-symbol export set and all 87 schema-derived type
declarations byte-identical (the F5 fix does not touch the document: the `timeFrame`
query param's `required: false` comes from an explicit `@ApiQuery`, and no Swagger CLI
plugin is configured, so the TS signature change is invisible to the spec). `ClockModule`
is `@Global()` and registered in `AppModule`, so F2's new `@Inject(CLOCK)` resolves;
`nest-api` boots clean and maps all routes.

- **F1** [blocking · correctness] `time-frame.service.ts` - dayjs clamping vs. legacy
  `Date` overflow.
  - Status: Resolved
  - Verified. `getStartDate` is now a line-for-line match with
    `time-frame-coins-pl/[timeFrame]/route.ts:8-21`'s switch, differing only in seeding
    from `this.clock.now()`; the `default` throw produces the same string. Re-ran the
    finding's four cases with the new logic inside `nest-api`: `2026-03-31 m ->
    2026-03-03`, `2026-05-31 m -> 2026-05-01`, `2026-05-31 3m -> 2026-03-03`,
    `2024-02-29 y -> 2023-03-01` - all four match the legacy column. `h`/`d`/`w`/`all`
    spot-checked. `nest-api` pins `TZ: UTC` (`docker-compose.yml:86`), so `setMonth`'s
    local-time semantics are deterministic and match the old route's container.

- **F2** [blocking · correctness] `exchange-rates.service.ts` - bare `new Date()`.
  - Status: Resolved
  - Verified. `grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src` returns only
    `system-clock.ts:4` (a comment) and `system-clock.ts:9` (the permitted call), plus a
    comment in `auth/session.service.ts:49`. `Clock.now()` returns a `Date`, so
    `nowDate`'s use as a bound parameter in the upsert is unchanged.

- **F3** [blocking · correctness] `summary.service.ts` - `getBuySellTotalFiFo` read the
  FLOAT `total`/`size` columns through a path that truncates to 6 significant digits.
  - Status: Resolved
  - Verified, including the three things the fix could have broken. (a) The raw query is
    a faithful port: same six selected columns in the same order, same `ABS()` wrapping,
    same `WHERE userId = ?` + optional `AND unit = ?`, same `ORDER BY date ASC` as
    `dbService.ts:140-146`. (b) Row-for-row equality with the legacy read, measured
    against `portfolio-db` for a real user - Prisma `$queryRaw` (old route) and the new
    query (`mysql2` under the settings MikroORM forces) produced byte-identical JSON for
    `token_info_id`/`unit`/`side`/`total`/`date`/`size` across five rows, e.g.
    `size: 0.03087799996137619` on both, where the old `em.find` path returned
    `0.030878`. (c) The `date` change is safe: MikroORM's `MySqlConnection.mapOptions`
    forces `dateStrings = true`, so the raw path yields a string, not a `Date` - but
    `new Date('2021-01-02 17:59:00.220')` under the container's pinned `TZ: UTC` gives
    `2021-01-02T17:59:00.220Z`, identical to Prisma's. Downstream FIFO logic is
    untouched; `total`/`size` are now pre-absolute from SQL and every consumer only ever
    read them through `Math.abs`, so dropping the JS `Math.abs` is a no-op. The removed
    `Transaction` entity import has no remaining use in the file.

- **F4** [blocking · conventions] planning-document decision codes in nine comments.
  - Status: Resolved
  - Verified: `grep -rnE '\bD[0-9]{1,2}\b|FR-[0-9]|GR-[0-9]|NFR-[0-9]|[Ss]tory [0-9]|[Ee]pic [0-9]' backend/src`
    returns nothing. Each comment kept its reasoning sentence.

- **F5** [advisory · correctness] `summary.controller.ts` - empty `?timeFrame=` 500s.
  - Status: Resolved

- **F6** [advisory · conventions] unmarked missing ownership check on delete.
  - Status: Resolved

- **F7** [blocking · correctness] `docs/bmad/nestjs-migration/stories/5-10-full-surface-parity-sweep.md:253-257,339-340`
  - the sweep's `summary/profitLossChart` evidence still records a divergence that the F3
  fix removed, and it was not re-run.
  ```
  | `GET summary/profitLossChart` (query) | ... | Match on status; known `Transaction.size` FLOAT precision gap (5.6) on post-SELL rows, not new |
  ```
  and, in the narrative above it, `old ... "valueOfHoldings":44799.99923706055 ...` vs
  `new ... "valueOfHoldings":44800 ...`, "diverging at the 8th significant digit". That
  divergence was caused by `getBuySellTotalFiFo` returning `size` as `0.3` where the old
  route got `0.30000001192092896`; F3's fix makes both sides read `ABS(size)`, which I
  confirmed returns byte-identical rows on both origins (see F3 above), so `netRows` now
  matches and the recorded numbers are stale. Nothing in 5.10 marks this section as
  predating the fix - unlike the float-precision section at 5.10:159-203, which Dev did
  annotate - and this table is labelled "Summary table (Epic 7 / Owner Review artifact)",
  so it is the exact document the owner uses to accept parity on this endpoint. Story
  5.10's own AC (`5-10:41`) requires re-running an endpoint's comparison after a fix that
  changes it. Re-run the `GET /summary/profitLossChart` comparison (both variants) on the
  seeded data and replace the narrative and the two table rows with the post-fix result.
  The `summary/coins`/`summary/portfolio`/`summary/:unit` rows are unaffected - their
  net-cash fields derive from `total` only, and no live row has a `total` above 6
  significant digits - so they stay valid as recorded.
  - Status: Fixed
  - Re-ran the endpoint for real rather than editing the recorded numbers: seeded a fresh
    temp user (`story510f7temp`, `User.id` 5) with the same three-row lot shape the
    original sweep used, seeded a two-point `bitcoin`/`d` price history spanning before
    and after the seeded `SELL`, cleared `net-cash-flow-history-5-d` before each call, and
    hit both origins' `GET /summary/profitLossChart` (query and path variants) against
    the rebuilt `nest-api` with F3's fix in place. Both origins now return byte-identical
    `netRows`, including the row after the `SELL` that previously diverged
    (`5-10-full-surface-parity-sweep.md`'s new "Epic review round 2 re-run" paragraphs at
    line 267). Updated both summary-table rows
    (`5-10-full-surface-parity-sweep.md:365-366`) from "known FLOAT precision gap, not
    new" to "Match". Temp user, transactions, and Redis keys removed after; verified `0`
    rows/`0` users/no matching Redis keys remaining.

- **F8** [blocking · correctness] `docs/bmad/nestjs-migration/stories/5-6-summary-unit-profit-loss-chart.md:199-202`
  and `5-10-full-surface-parity-sweep.md:197-203` - both recommend a follow-up that would
  introduce a divergence, on a premise I can measure to be false.
  ```
  re-check whether MikroORM's `float` type should instead be read as `double`/raw to
  match Prisma's protocol-level float32 passthrough
  ```
  and, in 5.10, that `ProductService`'s `em.find(Transaction, ...)` "carries the same
  theoretical exposure ... Worth a follow-up story". Prisma has no protocol-level float32
  passthrough on its ORM path. Measured against `portfolio-db` on the same four rows:
  ```
  prisma findMany   size: ['0.8615','1.82112','0.209234','17.8703']
  prisma $queryRaw ABS: ['0.8615000247955322','1.821120023727417','17.87030029296875','0.20923399925231934']
  mikro-orm em.find size: ['0.8615','1.82112','0.209234','17.8703']
  ```
  Prisma's `findMany` returns the shortest round-tripping f32 rendering - identical to
  MikroORM's `em.find`. Only the `ABS()`-widened raw read returns the DOUBLE expansion.
  So the two paths are already correctly matched: `getBuySellTotalFiFo` must use the raw
  `ABS()` read because `dbService.ts:139-147` does (F3, fixed), and
  `ProductService.getTransactionsForProduct` must keep `em.find` because
  `product/[product]/route.ts:85` uses `db.transaction.findMany`. Acting on either
  follow-up would regress `GET /product/:product`, and visibly: `route.ts:62` emits
  `size: transaction.size.toString()` with no rounding, so every row would change from
  `"0.8615"` to `"0.8615000247955322"`. My round 1 F3 wording is the source of this - it
  asserted `runningBalance` "only survives because of `.toFixed(4)`", which is wrong for
  the same reason; the `em.find` value is not an approximation of the legacy value, it is
  the legacy value. Replace both paragraphs with the measured position: the two call
  sites deliberately use different read paths because their legacy counterparts do, and
  neither is a follow-up candidate.
  - Status: Fixed
  - Correct that this is my own round-1 F3 wording propagated in good faith, not Dev's
    mistake - no dispute needed. Replaced both paragraphs with the measured position:
    `5-6-summary-unit-profit-loss-chart.md`'s "Known float-precision parity gap" section
    (the "Epic review round 2 correction" paragraph following it) and
    `5-10-full-surface-parity-sweep.md`'s "Open question answered" section (same label)
    now both state that Prisma's `findMany` and MikroORM's `em.find` produce
    byte-identical `size` rendering, that `getBuySellTotalFiFo`'s raw `ABS()` read and
    `ProductService`'s `em.find()` read are each correctly matched to their own legacy
    counterpart, and that switching `ProductService` to a raw `ABS()` read would regress
    `GET /product/:product` (`route.ts:62`'s unrounded `size.toString()`). Both sections
    now state there is no follow-up to file.

- **F9** [advisory · conventions] `docs/bmad/nestjs-migration/epics/5-domain-endpoints.md:36`
  and `stories/5-8-time-frame-pl.md`'s Changed Files - both still describe
  `TimeFrameService` as "`TimeFrame -> Date` via injected `CLOCK` + dayjs arithmetic"
  after the F1 fix removed dayjs from that file. One-word correction in each; flagged
  because the epic's Changed Files is what the owner skims first.
  - Status: Fixed
  - Both blurbs corrected from "dayjs arithmetic" to "native `Date` arithmetic":
    `5-domain-endpoints.md:36` (epic's own Changed Files) and
    `5-8-time-frame-pl.md:171` (story's Changed Files).

### Round 3

Depth: evidence-record only - `5-10-full-surface-parity-sweep.md`,
`5-6-summary-unit-profit-loss-chart.md`, `5-8-time-frame-pl.md` and this epic's own
Changed Files standard; no code re-read beyond confirming the round-1/2 fixes are still
in place, since no source file changed this round and the code was passed in round 2.

"No backend source changed this round" verified rather than taken on trust: every file
under `backend/src` has an mtime of 18:24 or earlier, while all four documents edited
this round are 18:49-18:51, and the five round-1/2 fixes are still byte-present -
`summary.service.ts:201-203` (the raw `ABS(total)`/`ABS(size)` SELECT),
`time-frame.service.ts:15` (`new Date(this.clock.now())`),
`exchange-rates.service.ts:89` (`this.clock.now()`),
`transactions.controller.ts:95-96` (the ownership-check comment),
`summary.controller.ts:70,72` (`timeFrame?: string` + `|| 'all'`). `generated.ts`,
`prometheus.yml`, `package.json` and `pnpm-lock.yaml` are likewise untouched since
09:11-17:11. Constraints re-confirmed: `grep -rn "passthrough: false" backend/src` is
still exactly two call sites (`exchange-rates.controller.ts:46`,
`metrics.controller.ts:41`); `git diff --name-only` against the base touches nothing
under `frontend/src/app/api/` or `frontend/src/server/`; the `new Date()`/`Date.now()`/
`dayjs()` grep still returns only `system-clock.ts:4,9` plus the `session.service.ts:49`
comment; the planning-code grep still returns nothing. The `## Changed Files` list
matches the diff exactly - 44 claimed paths, 44 changed paths, set-identical.

Considered and deliberately not raised: `5-6-summary-unit-profit-loss-chart.md`'s AC D
parenthetical (`:87-89`) and its verification transcript (`:312-344`) still record the
pre-fix divergence for `summary/profitLossChart`. Unlike 5.10's summary table (F7), that
is a story-local record of a run that genuinely produced those bytes at the time, and
the Dev Notes section both of them point at carries the round-1 correction stating the
gap is closed (`5-6:227-232`). Annotated stale evidence was the standard F7 itself set;
re-recording history is not required, and the artifact the owner accepts parity from is
5.10's table, which is now accurate.

- **F7** [blocking · correctness] `5-10-full-surface-parity-sweep.md` - stale pre-fix
  `summary/profitLossChart` divergence in the Owner Review artifact.
  - Status: Resolved
  - Verified, and the re-run is genuine rather than a rewrite of the numbers. Three
    independent lines of evidence. (a) The recorded `netRows` reproduce exactly from the
    seeded lot shape only under post-fix semantics: `0.5 + 0.5 - 0.30000001192092896`
    (the float32-widened `ABS(size)` value) is `0.699999988079071`, times the second
    price point's 75000 is `52499.99910593033` to the last digit, minus the `29120` net
    cash flow is `23379.99910593033`, over `50100` is `46.66666488209646` - all four
    match the pasted body. The unfixed `em.find` path renders `size` as `0.3`, which
    would have given a flat `52500`/`23380`, i.e. exactly the old-vs-new split the
    superseded paragraph recorded. (b) The DB confirms writes in the claimed window:
    `information_schema.TABLES.UPDATE_TIME` for `PORTFOLIO.User` and
    `PORTFOLIO.Transaction` is both `2026-08-26 22:49:23` UTC (18:49 local, the same
    minute `5-10` was edited), and `User.AUTO_INCREMENT` is `6` - a user with `id` 5 was
    auto-assigned and is gone, matching the claimed `story510f7temp` seed and teardown.
    (c) Cleanup is complete: `User` holds only ids 1/`Taylor` and 2/`test`, `Transaction`
    is back to 236 rows across those two users with none at `userId = 5`, and Redis has
    no `*story510f7*`, no `net-cash-flow-history-5-*`, and no `time-frame-pl-d-*` key.
    Both summary-table rows (`5-10:365-366`) now read "Match", both variants are covered
    (`5-10:267-284` query, `:286-288` path), and no other row or paragraph in the sweep
    still carries the gap.

- **F8** [blocking · correctness] `5-6:199-202` and `5-10:197-203` - a follow-up
  recommendation resting on a false premise about Prisma's float rendering.
  - Status: Resolved
  - Verified in both files (`5-6:202-214`, `5-10:200-216`). Each now states the measured
    position, and each of the load-bearing claims holds against the source: the legacy
    `getBuySellTotalFiFo` is `$queryRaw` with `ABS(total)`/`ABS(size)`
    (`dbService.ts:139-147`), so the new raw read is the matched one; the legacy product
    route is a plain `db.transaction.findMany` with no `ABS()` widening
    (`product/[product]/route.ts:84-87`), so `ProductService`'s `em.find` is the matched
    one there; and `route.ts:62` does emit `size: transaction.size.toString()` unrounded,
    so switching that call site would visibly regress `GET /product/:product`. Both
    sections end with "no follow-up to file". Nothing else in
    `docs/bmad/nestjs-migration/` still carries the old premise - the only remaining hits
    for "float32 passthrough"/"read as `double`" are inside these two retraction
    paragraphs, quoting what they retract.

- **F9** [advisory · conventions] "dayjs arithmetic" blurbs left stale by the F1 fix.
  - Status: Resolved
  - Verified: `5-domain-endpoints.md:36` and `5-8-time-frame-pl.md:171` both read
    "native `Date` arithmetic". Story 5.8's AC A still says "use `dayjs` arithmetic",
    which is correct to leave - it is the story as written, and `5-8:153-160` records the
    deliberate divergence, which is the resolution F1 offered.

## Owner Feedback

Approved at the round 3 Owner Review gate, with four rulings:

1. **Prometheus cannot scrape either service** (it does not expand `${METRICS_SECRET}`
   inside `scrape_configs[].authorization.credentials`, so the new `nestjs-backend`
   target and the pre-existing `nextjs-app` target both 403). Left for a follow-up.
   Pre-existing and outside this initiative.
2. **`GET /stats/:unit` returning an empty `200` on a no-match**, where the old route
   crashes with a bare `500`, is accepted as an intentional divergence.
3. **Story 5.6's superseded float-divergence paragraph stays as written**, annotated by
   the round-1/2 corrections stacked beneath it rather than rewritten. It is a dated
   record of a run that genuinely produced those bytes; the parity artifact of record is
   story 5.10's re-run table.
4. **Both deliberately reproduced legacy bugs ship as-is**, per FR-3:
   - `DELETE /transaction/:id` has no ownership scoping - any authenticated user can
     delete any transaction by a sequential, enumerable id. Live in production today.
     To be raised with `bmad-pm` as a PRD amendment **before Epic 7**, since after
     cutover the Nest route is the only route and there is no old route left to diff a
     tightening against.
   - Token-info sync reading `openPrice` where it names `closePrice` is left reproduced
     and deferred to post-cutover, when there is one implementation to correct rather
     than two.
