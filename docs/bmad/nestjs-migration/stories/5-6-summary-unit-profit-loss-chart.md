# Story 5.6: Summary, part 2 - GET /summary/:unit, GET /summary/profitLossChart(/:timeFrame)

Status: Done

## Context

Follows story 5.1's pattern, and reuses story 5.5's `SummaryService.getCoinSummaries`
and `ExchangeRatesService.refreshRates()` (already exported/injectable) for the `:unit`
endpoint - do not re-derive that query. Also depends on story 5.2's Redis provider
(`@Inject(REDIS)`, `RedisModule` is `@Global()` so no module import is needed - both
`profitLossChart` variants cache in Redis), story 5.2's
`ExchangeRatesService.getPriceHistoryForTimeFrame` (consumed through the net-cash-flow
chart calculation below), and story 5.3's `TokenInfoService.getTokensForUserId` (the
per-coin list the chart calculation joins against price history) - `SummaryModule`
imports `TokenInfoModule` to inject it. **Use that method directly; do not write a
second copy of the `Transaction`/`TokenInfo` join.**

**Landmine, already confirmed in the inventory - read this before writing any code
here.** Two functions named `getNetCashFlowHistory` exist and are not
interchangeable: `dbService.ts`'s reads pre-computed `NetCashFlow` table rows and is
called by nobody; `frontend/src/server/helpers/update-price-history.ts`'s is a live
computation over `getBuySellTotalFiFo` + cached price history, and is the one both
`profitLossChart` routes actually call. Port the **helpers** version. Porting the
`dbService.ts` one would compile, look plausible, and return the wrong shape.

## Acceptance Criteria

### A. `summary/:unit`

- [x] `SummaryService.getCoinsByUnit(userId: number, unit: string):
      Promise<CoinSummaryResponseDto[]>` - calls `this.getCoinSummaries(userId, unit)`
      (story 5.5) and the per-unit net-cash-flow helper (5.5's
      `getNetCashFlowAndContributions(userId, unit)`), mapping identically to
      `getCoins`'s shape (`summary/[unit]/route.ts:44-61` is byte-identical to
      `summary/coins/route.ts:42-59` except for the `unit` filter - reuse the same
      mapping code, don't duplicate it).
- [x] `summary.controller.ts`'s `getByUnit` calls `summaryService.getCoinsByUnit(user.sub,
      unit)`.

### B. `NetCashFlowChartService` (or a method on `SummaryService` - dev's call, record
which)

- [x] Port `update-price-history.ts`'s `getPriceHistoryMap(userId, timeFrame,
      firstTxDate)` (lines 12-58) and `getNetCashFlowHistory(userId, timeFrame)` (lines
      60-148): the FIFO tax-lot-free running-holdings walk over
      `SummaryService.getBuySellTotalFiFo(userId)` joined against per-date price points
      from `ExchangeRatesService.getPriceHistoryForTimeFrame` for each coin in
      `TokenInfoService.getTokensForUserId(userId)` (story 5.3 - inject `TokenInfoService`
      via `imports: [TokenInfoModule]`, do not re-query the join). Returns
      `ProfitLossChartResp | undefined` (`undefined` when the user has no transactions -
      `update-price-history.ts:65-68`). Use `dayjs` (already a backend dependency as of
      story 5.3) in place of every `moment(...)` call in the ported logic.
- [x] Wrap it in the endpoint logic ported from
      `summary/profitLossChart/route.ts`/`[timeFrame]/route.ts` (identical bodies,
      confirmed by reading both files in full - one reads `?timeFrame=`, the other reads
      the path param, nothing else differs): Redis cache key
      `net-cash-flow-history-{userId}-{timeFrame}`, TTL 3600s, checked before computing;
      on a miss, compute via the port above, substitute `{ netRows: [],
      lowestPointIndex: 0, highestPointIndex: 0 }` when it returns `undefined`, cache
      the (possibly-substituted) result, and return it.
- [x] `refreshData` (defined at the top of both legacy route files, calling
      `syncPriceHistoryToDbForUserId` + `updateNetCashFlowTableData`) is **dead code -
      confirm it is never invoked in either route's `GET` handler** (both files define
      it, neither calls it) and do not port it. This is the same fact story 5.3's Out of
      Scope already recorded for `updateNetCashFlowTableData`; recorded again here since
      it's the second of the two dead-refreshData sightings and worth confirming rather
      than assuming it's still true.

### C. Controller wiring

- [x] `summary.controller.ts`'s `getProfitLossChartByQuery` and
      `getProfitLossChartByParam` both call the same service method (from AC B) with
      their respective `timeFrame` source (`?timeFrame=`, default `'all'`, vs the path
      param) - do not implement the logic twice.
- [x] `SummaryModule` registers whatever new provider AC B introduces, and imports
      `TokenInfoModule` (for `TokenInfoService`). No `RedisModule` import is needed - it
      is `@Global()` (story 5.2).

### D. Parity and regression

- [x] NFR-4: `GET /summary/{unit}` for a held unit against both origins. `GET
      /summary/profitLossChart?timeFrame=d` and `GET
      /summary/profitLossChart/d` against both origins for the same user - confirm
      identical `netRows`/`lowestPointIndex`/`highestPointIndex`, including the epoch-ms
      `date` field's exact values. Confirm a user with no transactions gets the `{
      netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }` fallback on both. (Dates,
      indices, and rows up to the seeded `SELL` matched byte-for-byte; two rows after it
      diverge at the 8th significant digit due to a pre-existing, out-of-scope
      float-precision gap in `getBuySellTotalFiFo` - see Dev Notes.)
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.

## Technical Notes

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `summary/[unit]`,
`summary/profitLossChart (query variant)`, and `summary/profitLossChart/[timeFrame]`
sections, and the "Landmines confirmed" section's `getNetCashFlowHistory` entry. Live
source: `frontend/src/server/helpers/update-price-history.ts`,
`frontend/src/app/api/summary/[unit]/route.ts`,
`frontend/src/app/api/summary/profitLossChart/route.ts`,
`frontend/src/app/api/summary/profitLossChart/[timeFrame]/route.ts`.

### DTOs already scaffolded

`backend/src/summary/dto/profit-loss-chart-response.dto.ts` - complete from Epic 2, no
changes expected.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
# functional + parity checks per AC D, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- `getCoinSummaries`, `getPortfolioSummary`, `getBuySellTotalFiFo`,
  `ExchangeRatesService.refreshRates()`/`getPriceHistoryForTimeFrame`, and
  `TokenInfoService.getTokensForUserId` - stories 5.5/5.2/5.3, consumed here.
- `updateNetCashFlowTableData` / any `NetCashFlow` write - confirmed dead code, not
  ported (AC B).
- `stats/:unit` and `product/:product` - story 5.7.

## Dev Notes

### Which `getNetCashFlowHistory` is live

Two functions share the name. `dbService.ts:238` defines one and re-exports it at
`dbService.ts:428` as part of the default-exported object, but `grep -rn
"getNetCashFlowHistory" frontend/src` shows the only other references to that name are
its own declaration/export line - nothing in `frontend/src/app` ever calls
`DBService.getNetCashFlowHistory`. Both `summary/profitLossChart/route.ts` and
`summary/profitLossChart/[timeFrame]/route.ts` instead `import { getNetCashFlowHistory
} from '@/server/helpers/update-price-history'` and call that one directly. That's the
one ported here (`SummaryService.getNetCashFlowHistory`, private, wrapping
`getPriceHistoryMap` + the FIFO walk over `getBuySellTotalFiFo`) - the `dbService.ts`
version (which reads a pre-computed `NetCashFlow` table `updateNetCashFlowTableData`
never gets called to populate, per below) was not ported.

`refreshData` (top of both legacy route files, calling `syncPriceHistoryToDbForUserId` +
`updateNetCashFlowTableData`) is declared in both files but its `GET` handler never
calls it - confirmed by reading both handlers in full (they go straight from the Redis
cache check to `getNetCashFlowHistory`). Not ported, per the story's Out of Scope.

### Service placement

Added the two new methods (`getPriceHistoryMap`, `getNetCashFlowHistory`) and the
public `getProfitLossChart` cache wrapper directly on `SummaryService` rather than a
separate `NetCashFlowChartService`. They share `getBuySellTotalFiFo` and the
`TokenPriceDate`/`UnitNetMap`-style private state with the rest of the service, and
every other per-domain service in this epic (`TokenInfoService`,
`ExchangeRatesService`, `PriceHistoryService`) already injects `REDIS` directly rather
than delegating caching to a separate service, so this keeps the same shape.

### Preserved bugs and simplifications

- `getPriceHistoryMap` destructures `[unixTimestamp, closePrice]` from the
  `[unixTimestamp, openPrice, closePrice]` tuple `getPriceHistoryForTimeFrame` returns -
  index 1 (`openPrice`), not index 2 (`closePrice`). This is the same off-by-one
  `token-info.service.ts:81` already documented for `syncPriceHistoryForUser`, and it's
  reproduced here rather than fixed, since the goal is byte-identical parity with the
  legacy chart, not a corrected one.
- Dropped the legacy function's two `logger.info` calls (routine progress tracing) and
  its unused `totalCostBasis` accumulator (computed but never read, even in the
  original) - neither affects the returned shape, and no other ported service in this
  epic logs at `info` for a normal request path (only `warn`/`error`, per
  `token-info.service.ts` and `credential-verifier.service.ts`).
- `tx.side?.toUpperCase() === 'SELL'/'BUY'` simplified to a direct `===` comparison:
  `BuySellFiFoRow.side` is already typed and populated as `'BUY' | 'SELL'`
  (`summary.service.ts`'s `getBuySellTotalFiFo`), so the `toUpperCase()` was a no-op.

### Known float-precision parity gap in `getBuySellTotalFiFo` (pre-existing, out of scope)

Diffing `GET /summary/profitLossChart/d` between origins for a seeded `SELL size: 0.3`
row surfaced a tiny mismatch: new gives `valueOfHoldings: 44800`, old gives
`44799.99923706055` (a ~1.7e-8 relative difference), propagating into `profitLoss` and
`roi` for rows after that transaction. Root cause: `Transaction.size` is a MySQL
`FLOAT` (single-precision) column; the byte-exact stored value for `0.3` is
`0.30000001192092896` (confirmed via `CAST(size AS DECIMAL(30,20))` directly against
`portfolio-db`). The legacy raw-SQL/Prisma read path returns that imprecise bit pattern
as-is; `getBuySellTotalFiFo`'s `em.find()` (MikroORM's `type: 'float'` mapping, from
story 5.5) returns the "clean" `0.3` instead. `getCoinSummaries`'s raw
`em.getConnection().execute()` path (also consumed here) does **not** have this gap -
its `holdings` field was confirmed byte-identical in the `summary/BTC` check below,
because both origins read that column through a raw/protocol-level query, not an ORM
entity mapping.

This is not introduced by this story: `getBuySellTotalFiFo` is explicitly Out of Scope
here ("consumed here", not re-derived), and the story's own instruction is to call it
directly rather than write a second copy of the read. Fixing it would mean changing
story 5.5's already-`Done` `getBuySellTotalFiFo`/entity mapping, which every other
consumer of that method (`getCoins`, `getPortfolio`) has already been parity-verified
against in its current form.

**Epic review round 2 correction:** the follow-up this section originally proposed
("re-check whether MikroORM's `float` type should instead be read as `double`/raw to
match Prisma's protocol-level float32 passthrough") rested on a false premise. Prisma has
no protocol-level float32 passthrough on its ORM read path - measured directly against
`portfolio-db`, `prisma.transaction.findMany`'s `size` values (`0.8615`, `1.82112`,
`0.209234`, `17.8703`) are byte-identical to MikroORM's `em.find()` values on the same
rows; only an `ABS()`-wrapped raw `SELECT` returns the wider DOUBLE expansion
(`0.8615000247955322`, ...). So `getBuySellTotalFiFo`'s raw `ABS()` read and
`ProductService`'s `em.find()` read are not the same call site with an inconsistent fix -
they are already correctly matched to their own legacy counterparts:
`dbService.ts:139-147` (which `getBuySellTotalFiFo` ports) also uses `ABS()`, while
`product/[product]/route.ts:85` (which `ProductService` ports) uses plain
`findMany`/`em.find`. There is no follow-up to file here.

**Epic review round 1 correction:** `getProfitLossChartByQuery`'s `@Query('timeFrame')
timeFrame = 'all'` default only applies when the param is absent (`undefined`) - an
explicitly empty `?timeFrame=` passed `''` through, and `''` is falsy but not
`undefined`, so it reached `getPriceHistoryForTimeFrame`'s `!timeFrame` guard and threw
a 500 where `summary/profitLossChart/route.ts:29`'s `searchParams.get('timeFrame') ||
'all'` treats an empty string as absent and returns `200`. Changed the parameter to
`timeFrame?: string` and the call site to `timeFrame || 'all'`, matching the old route.
No known caller sent an empty value; verified live after the fix:
`GET /summary/profitLossChart?timeFrame=` now returns `200
{"netRows":[],"lowestPointIndex":0,"highestPointIndex":0}`.

**Epic review round 1 correction:** the "~1.7e-8 relative difference" framing above
understated the real bound - it's MySQL's 6-significant-digit text-protocol rendering
for FLOAT columns, not a fixed small delta, and it grows with the transacted amount (see
story 5.5's Dev Notes for the corrected analysis and the fix: `getBuySellTotalFiFo` now
reads `total`/`size` via a raw `ABS()`-wrapped `SELECT`, closing this gap rather than
leaving it as a documented-but-live risk).

### `frontend/src/api/generated.ts` diff is a pure reorder, not a content change

Same mechanism as story 5.5's note: `SummaryModule` now imports `TokenInfoModule`
(previously it only imported `ExchangeRatesModule`), which changes Nest's module
instantiation order and therefore the order `SwaggerModule` walks routes into the
OpenAPI document, reordering unrelated blocks (e.g. `token-info/:userId`'s DTOs move
ahead of `stats/:unit`'s) in Orval's output. Confirmed no content changed: `git show
HEAD:frontend/src/api/generated.ts | sort` and `sort frontend/src/api/generated.ts`
diff to nothing - same 2713 lines, same set of lines, only their order differs.
Regenerated and left staged for commit per the story's Verification block.

### Changed Files

+ backend/src/summary/summary.service.ts   injects `TokenInfoService`/`REDIS`; adds `getCoinsByUnit` (+ shared `mapCoinSummaries` extracted from `getCoins`), the ported `getPriceHistoryMap`/`getNetCashFlowHistory` FIFO chart walk, and the Redis-cached `getProfitLossChart` wrapper
~ backend/src/summary/summary.controller.ts   `getByUnit`, `getProfitLossChartByQuery`, `getProfitLossChartByParam` call the real service methods instead of throwing; removed their now-stale "will call" comments
~ backend/src/summary/summary.module.ts   imports `TokenInfoModule` (for `TokenInfoService`); no `RedisModule` import needed, it's `@Global()`
~ frontend/src/api/generated.ts   regenerated against the rebuilt `nest-api`; pure block reorder from the `SummaryModule` -> `TokenInfoModule` import (see note above), no content change

### Verification

```
$ pnpm --filter @portfolio/backend typecheck
$ tsc --noEmit -p tsconfig.json
(no output - passed)

$ pnpm --filter @portfolio/backend lint
$ eslint "{src,test}/**/*.ts"
backend/src/main.ts 31:1  warning  no-floating-promises on bootstrap() - pre-existing, untouched by this story
✖ 1 problem (0 errors, 1 warning)

$ pnpm --filter @portfolio/backend build
$ nest build
(no output - passed)

$ docker compose up -d --build nest-api
(built and started cleanly; full RoutesResolver log confirms summary/:unit,
summary/profitLossChart, and summary/profitLossChart/:timeFrame all mapped)
```

**Functional + parity checks (AC D)**

Two temporary users were inserted directly into `portfolio-db` for the duration of the
check: `story56temp` (id 10, with real transaction history) and `story56temp2` (id 11,
zero history), following the same approach as prior stories (bcrypt-hashed inside the
running `nest-api` container). Two `Transaction` rows were seeded for user 10, unit
`BTC` (`token_id: 1`, already-rated so no `ExchangeRate` change was needed): a `BUY`
(`size 1 @ 50000 fee 100` -> `total -50100`, dated `2026-08-24 05:00:00`) and a `SELL`
(`size 0.3 @ 70000 fee 20` -> `total 20980`, dated `2026-08-25 05:00:00`) - matching
`TransactionsService`'s own `total` formula.

A synthetic `PriceHistoryResponseDto` for `bitcoin`/`d` (six hourly points from
`2026-08-23 12:00` to `2026-08-26 00:00`, open prices `60000`-`65000` step `1000`) was
written directly to the shared Redis instance under `time-frame-pl-d-coinName-bitcoin`
(TTL 3600s) - both origins read this exact key/format
(`get-exchange-rates.ts:119`/`exchange-rates.service.ts:115`), so this seeds both
origins identically rather than requiring a real external price-history sync.

Sessions: old-route session via the real NextAuth CSRF + credentials-callback flow
(`__Secure-next-auth.session-token`), new-route session via `POST
/backend/api/auth/login`. Both verified against `GET .../auth/session` resolving to the
same `User.id` (10, then 11).

**`GET /summary/BTC` (AC A) - user 10 (real history) - old vs new, full raw JSON**
```
[{"productName":"BTC","coinName":"Bitcoin","avgPurchasePrice":50100,"avgSellPrice":69933.33055443245,
"holdings":0.699999988079071,"valueOfHoldings":54826.62406630814,"profitLossAtCurrentPrice":25706.62406630814,
"percentPL":51.31062687885857,"currentPrice":78323.75,"breakEvenPrice":41600.00070844379,"inGreen":true,
"totalBuyCost":50100,"totalSellProfits":20980,"costBasis":29120,"netContributions":50100,"netCashHoldings":20980}]
```
Byte-identical on both origins, including the raw-SQL-sourced `holdings` field's
float32-derived value (`0.699999988079071`) - confirms `getCoinSummaries`'s
`em.getConnection().execute()` path deserializes identically to Prisma's `$queryRaw`
here, same as story 5.5's finding.

**`GET /summary/BTC` - user 11 (zero history) - old vs new**: `[]` on both, confirming
the `unit`-filtered `getCoinSummaries`/`getNetCashFlowAndContributions` pair composes
correctly for a user with no rows for that unit.

**`GET /summary/profitLossChart?timeFrame=d` (AC B/C, query variant) - user 10 - old
vs new, cache cleared before each call so each origin genuinely recomputes rather than
reading the other's cached write**
```
new: {"netRows":[{"date":1787486400000,"valueOfHoldings":0,"profitLoss":0,"roi":0},
{"date":1787529600000,"valueOfHoldings":0,"profitLoss":0,"roi":0},
{"date":1787572800000,"valueOfHoldings":62000,"profitLoss":11900,"roi":23.75249500998004},
{"date":1787616000000,"valueOfHoldings":63000,"profitLoss":12900,"roi":25.748502994011975},
{"date":1787659200000,"valueOfHoldings":44800,"profitLoss":15680,"roi":31.297405189620758},
{"date":1787702400000,"valueOfHoldings":45500,"profitLoss":16380,"roi":32.69461077844311}],
"lowestPointIndex":0,"highestPointIndex":5}

old: {"netRows":[{"date":1787486400000,"valueOfHoldings":0,"profitLoss":0,"roi":0},
{"date":1787529600000,"valueOfHoldings":0,"profitLoss":0,"roi":0},
{"date":1787572800000,"valueOfHoldings":62000,"profitLoss":11900,"roi":23.75249500998004},
{"date":1787616000000,"valueOfHoldings":63000,"profitLoss":12900,"roi":25.748502994011975},
{"date":1787659200000,"valueOfHoldings":44799.99923706055,"profitLoss":15679.999237060547,"roi":31.29740366678752},
{"date":1787702400000,"valueOfHoldings":45499.99922513962,"profitLoss":16379.999225139618,"roi":32.694609231815605}],
"lowestPointIndex":0,"highestPointIndex":5}
```
All 6 `date` values (epoch ms) identical, `lowestPointIndex`/`highestPointIndex`
identical, and every row up to the `SELL` transaction (rows 0-3) byte-identical. Rows 4
and 5 (after the `size: 0.3` `SELL` is applied) differ starting at the 8th significant
digit - see "Known float-precision parity gap" in Dev Notes for the confirmed root
cause (`Transaction.size`'s `FLOAT`-column storage, read exactly by the raw/Prisma path
and "cleaned" by MikroORM's `em.find()` in `getBuySellTotalFiFo`, from story 5.5, out of
this story's scope).

**`GET /summary/profitLossChart/d` (path-param variant) - user 10 - old vs new**: same
recompute-each-side method, same result - identical to the query variant above on each
origin (confirming AC C's "both call the same service method" for the new side, and
the legacy files' documented identical bodies for the old side), with the same
float-precision gap in rows 4-5 for the reason above.

**Zero-history fallback (AC B) - user 11 - `GET /summary/profitLossChart` (default
`timeFrame=all`) - old vs new**: `{"netRows":[],"lowestPointIndex":0,"highestPointIndex":0}`
on both - confirms the `undefined` -> fallback substitution.

**Cache-hit path** - a same-key repeat `GET /summary/profitLossChart?timeFrame=d`
(no Redis delete in between) returned the previously-cached JSON unchanged with `TTL
net-cash-flow-history-10-d` at 3570s (30s elapsed of the 3600s TTL) - confirms the
Redis read-through path returns the cached value rather than recomputing.

**Unauthenticated**: `GET /backend/api/summary/BTC`, `/summary/profitLossChart`, and
`/summary/profitLossChart/d` with no session cookie all returned `401
{"error":"Unauthorized"}` via `SessionGuard` + `AllExceptionsFilter` - no new
`@Res({ passthrough: false })` carve-out introduced.

All temporary `Transaction` rows (ids 2009-2010), `User` rows (`story56temp`,
`story56temp2`), and the temporary Redis keys (`time-frame-pl-d-coinName-bitcoin`,
`net-cash-flow-history-{10,11}-{d,all}`) were deleted afterward.

```
$ docker compose up -d --build nest-api
(rebuilt and started cleanly)

$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
 M frontend/src/api/generated.ts
(non-empty - pure reorder, see "frontend/src/api/generated.ts diff is a pure reorder"
note above; committed)
```

### Verification
