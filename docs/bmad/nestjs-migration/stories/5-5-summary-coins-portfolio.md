# Story 5.5: Summary, part 1 - GET /summary/coins, GET /summary/portfolio

Status: Done

## Context

Follows story 5.1's pattern, and **establishes `SummaryService` as the home for the
three core aggregation queries `dbService.ts` groups together** -
`getCoinSummaries`, `getPortfolioSummary`, `getBuySellTotalFiFo`. These three are
consumed well beyond the `summary` domain: story 5.6 reuses `getCoinSummaries` for
`summary/:unit`; story 5.7 reuses it for `stats/:unit`; story 5.8 reuses it (with the
`onDate` parameter) for both time-frame P/L endpoints. `SummaryModule` exports
`SummaryService`, and each of those later modules imports `SummaryModule` to inject it
- **none of them re-implement or copy this query**. Get its signature right here, since
three other stories build directly on it.

Also depends on story 5.2's `ExchangeRatesService.refreshRates()` - both endpoints here
call it before reading (`await getExchangeRates()` in the legacy routes), and so do
5.6's `summary/:unit` and 5.7's `stats/:unit`. `SummaryModule` imports
`ExchangeRatesModule`.

## Acceptance Criteria

### A. `SummaryService` - the shared aggregation queries

- [x] `backend/src/summary/summary.service.ts` - `@Injectable()`, injects
      `EntityManager`.
- [x] `getCoinSummaries(userId: number, unit?: string, onDate?: Date):
      Promise<CoinSummary[]>` - ports `dbService.ts:35-83`'s raw aggregate SQL verbatim
      via `em.getConnection().execute(sql, params)` (D16 - this is the flagship
      aggregate/rollup query the convention exists for). Reproduce the exact column
      aliases (`productName`, `coinName`, `currentPrice`, `countBuys`, `countSells`,
      `totalBuyQuantity`, `totalSellQuantity`, `totalBuyCost`, `totalSellProfits`,
      `holdings`, `avgPurchasePrice`, `avgSellPrice`, `valueOfHoldings`,
      `profitLossAtCurrentPrice`, `breakEvenPrice`, `percentPL`) and the optional
      `unit`/`onDate` filter clauses. **Check the runtime JS type of every returned
      column, not just its value** (architecture's named raw-deserialization-drift
      risk) - `em.getConnection().execute()` may not deserialize identically to
      Prisma's `$queryRaw` for aggregates/divisions; coerce at this method's boundary if
      a field arrives as a string where Prisma gave a number, and record the check
      (even if nothing needed coercing) in Dev Notes.
- [x] `getPortfolioSummary(userId: number): Promise<PortfolioSummary>` - ports
      `dbService.ts:93-136`'s raw aggregate SQL the same way, returning
      `transactionSummary[0]` (single row).
- [x] `getBuySellTotalFiFo(userId: number, unit?: string): Promise<{ token_info_id:
      string; unit: string; side: 'BUY' | 'SELL'; total: number; date: Date; size:
      number }[]>` - ports `dbService.ts:139-147`. This is a plain filtered `SELECT`
      ordered by `date ASC`, no aggregation - implement via `em.find(Transaction, {
      userId, ...(unit && { unit }) }, { orderBy: { date: 'asc' } })` mapped to the
      shape above (ORM half of D16's split, not raw), since there is no join or
      computed column here.

### B. `getCoins`/`getPortfolio` logic

- [x] Add `getNetCashFlowAndContributions(userId: number, unit?: string): Promise<{
      [unit: string]: { netCashHoldings: number; netContributions: number } }>` (for
      `summary/coins`) and its single-unit sibling (for `summary/portfolio`) as private
      methods or free functions in `SummaryService`, porting the FIFO-style walk at
      `summary/coins/route.ts:11-31` and `summary/portfolio/route.ts:7-24` exactly -
      both iterate `getBuySellTotalFiFo`'s date-ordered rows and accumulate
      `netCashHoldings`/`netContributions` with the same branch logic (a `SELL` adds to
      `netCashHoldings`; a `BUY` either draws down `netCashHoldings` or, once it's
      exhausted, adds the shortfall to `netContributions` and zeroes `netCashHoldings`).
- [x] `getCoins(userId: number): Promise<CoinSummaryResponseDto[]>` - calls
      `getCoinSummaries(userId)` and the net-cash-flow helper, maps to
      `CoinSummaryResponseDto` with `inGreen: profitLossAtCurrentPrice > 0` and
      `costBasis: totalBuyCost - totalSellProfits` derived in this service (not SQL),
      exactly as `summary/coins/route.ts:42-59`.
- [x] `getPortfolio(userId: number): Promise<PortfolioSummaryResponseDto>` - calls
      `getPortfolioSummary(userId)` and the net-cash-flow helper, computes
      `accountValue = valueOfHoldings + netCashHoldings`, `realizedReturn =
      netCashHoldings - netContributions`, `roi = (profitLoss / netContributions) *
      100` - **`roi` is `NaN` when `netContributions` is `0`; let it stay `NaN` and
      confirm `JSON.stringify`/Nest's response serialization turns it into `null`
      exactly as `NextResponse.json` does today** (`summary/portfolio/route.ts:33`,
      inventory's documented behavior) - do not special-case zero into `0` or an error,
      that would be an unrequested "improvement."
- [x] Both methods call `exchangeRatesService.refreshRates()` before reading, matching
      `await getExchangeRates()` at the top of both legacy routes.

### C. Controller wiring

- [x] `summary.controller.ts`'s `getCoins` calls `summaryService.getCoins(user.sub)`;
      `getPortfolio` calls `summaryService.getPortfolio(user.sub)`.
- [x] `SummaryModule` registers `SummaryService` in `providers`, adds it to `exports`,
      and imports `ExchangeRatesModule`.

### D. Parity and regression

- [x] NFR-4: `GET /summary/coins` and `GET /summary/portfolio` against both origins for
      the same authenticated user with real transaction history - diff every field
      including `inGreen`/`costBasis`/`roi`, and confirm the runtime JS type of every
      numeric field matches (not just its value) per the raw-deserialization check in
      AC A.
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.

## Technical Notes

### Entities

`backend/src/db/entities/transaction.entity.ts`, `exchange-rate.entity.ts` (read only,
via the raw SQL's join - no repository call needed on `ExchangeRate` directly here).

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `summary/coins` and
`summary/portfolio` sections list every field with its runtime type. Live source:
`frontend/src/server/db/dbService.ts` (`getCoinSummaries`, `getPortfolioSummary`,
`getBuySellTotalFiFo`), `frontend/src/app/api/summary/coins/route.ts`,
`frontend/src/app/api/summary/portfolio/route.ts`.

### DTOs already scaffolded

`backend/src/summary/dto/coin-summary-response.dto.ts`,
`portfolio-summary-response.dto.ts` - both complete from Epic 2, no changes expected.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
# functional + parity checks per AC D, pasted into Dev Notes, including runtime-type checks
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- `summary/:unit` and both `profitLossChart` variants - story 5.6, which reuses
  `getCoinSummaries` from this story rather than re-deriving it.
- `stats/:unit` - story 5.7, same reuse.
- Both time-frame P/L endpoints - story 5.8, same reuse plus the `onDate` parameter.

## Dev Notes

### Raw-deserialization-drift check (AC A)

Legacy `getCoinSummaries`'s outer `SELECT` references the joined rate column as
`stats.latestExchangeRate.rate` - a three-part identifier where `stats` is actually the
*other* subquery's alias, not a schema qualifier on `latestExchangeRate`. Verified
directly against `portfolio-db` (MySQL 5.7) that this is accepted and resolved purely by
the trailing `table.column` pair, ignoring any leading segment - a `garbage123.latestExchangeRate.rate`
substitution produced identical results. This is an inert quirk in the legacy SQL, not
semantics to preserve, so the ported query references `latestExchangeRate.rate` directly
and joins the inner grouped-by-`(unit, coinName)` subquery to the rate subquery exactly
as the original does (join after grouping, not folded into the `GROUP BY`) - the
computation is otherwise byte-for-byte the same expression tree.

Confirmed the runtime JS type of every populated numeric field by comparing the raw
JSON text (not just parsed values) from both origins for the same user/data (see
Verification below): every numeric field renders unquoted on both origins (a string
would render quoted), and the zero-history user's `null` fields (`purchases`,
`totalPLatCurrentPrice`, `roi`, etc.) match exactly, including `roi`'s `NaN -> null`
path. No `BigInt`/string coercion was needed at `em.getConnection().execute()`'s
boundary for either aggregate query.

### Epic review round 1 correction: `getBuySellTotalFiFo` no longer uses `em.find()`

AC A's instruction to implement `getBuySellTotalFiFo` "via `em.find(Transaction, ...)`"
turned out to reintroduce a real precision bug: `total`/`size` are MySQL `FLOAT`
columns, and MikroORM's read path (`em.find()`'s entity hydration, same as the raw
`em.getConnection().execute()` other queries in this file use) renders them through
MySQL's text protocol, which truncates FLOAT values to 6 significant digits. The legacy
`dbService.ts:139-147` reads the same columns through `ABS()`, which MySQL evaluates as
DOUBLE and returns at full precision - so a `total` with more than 6 significant digits
(no live row currently has one) would diverge visibly between origins. `getBuySellTotalFiFo`
was rewritten to read via a raw `SELECT ... ABS(total) AS total, ABS(size) AS size ...`,
matching `dbService.ts:139-147` exactly, rather than `em.find()`. The return shape and
every caller are unchanged.

### `frontend/src/api/generated.ts` diff is a pure reorder, not a content change

`SummaryModule` now imports `ExchangeRatesModule` (previously `SummaryModule` had no
inter-module dependency). `AppModule` lists `SummaryModule` before `ExchangeRatesModule`,
so making `ExchangeRatesModule` a dependency of `SummaryModule` changes Nest's module
instantiation order, which changes the order `SwaggerModule` walks routes into the
OpenAPI document, which reorders unrelated blocks (e.g. `exchange-rates/unit/:unit` and
`stats/:unit`) in Orval's output. Confirmed no content changed: `git show
HEAD:frontend/src/api/generated.ts | sort` and `sort frontend/src/api/generated.ts`
diff to nothing - same 2713 lines, same set of lines, only their order differs.
Regenerated and left staged for commit per the story's Verification block.

### Changed Files

+ backend/src/summary/summary.service.ts   `SummaryService` - `getCoinSummaries`/`getPortfolioSummary`/`getBuySellTotalFiFo` raw+ORM aggregate queries, FIFO net-cash-flow helpers, `getCoins`/`getPortfolio`
~ backend/src/summary/summary.controller.ts   `getCoins`/`getPortfolio` call the real service instead of throwing
~ backend/src/summary/summary.module.ts   registers `SummaryService` as a provider/export, imports `ExchangeRatesModule`
~ frontend/src/api/generated.ts   regenerated against the rebuilt `nest-api`; pure block reorder from the `SummaryModule` -> `ExchangeRatesModule` import (see note above), no content change

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
(built and started cleanly)
```

**Functional + parity checks (AC D)**

One temporary user with real transaction history (`story55temp`, id 8) and one
zero-history temporary user (`story55temp2`, id 9) were inserted directly into
`portfolio-db` for the duration of the check, along with three `Transaction` rows for
user 8 (unit `BTC`, an already-rated unit, chosen so no new `ExchangeRate` row - and no
change to the global "latest date" every user's summary depends on - was needed): two
`BUY`s (`size 1 @ 50000 fee 100` -> `total -50100`; `size 0.5 @ 60000 fee 50` -> `total
-30050`) and one `SELL` (`size 0.3 @ 70000 fee 20` -> `total 20980`), dated
2024-01-01/02-01/03-01 respectively - matching `TransactionsService`'s own `total`
formula so the seeded rows are exactly what `POST /transaction/add` would have written.

Sessions: old-route session via the real NextAuth CSRF + credentials-callback flow
(`__Secure-next-auth.session-token`); new-route session via `POST
/backend/api/auth/login`. Both verified against `GET .../auth/session` resolving to the
same `User.id` (8, then 9).

**`GET /summary/coins` - user 8 (real history) - old vs new, full raw JSON**
```
[{"productName":"BTC","coinName":"Bitcoin","avgPurchasePrice":53433.333333333336,
"avgSellPrice":69933.33055443245,"holdings":1.199999988079071,
"valueOfHoldings":94536.29906086624,"profitLossAtCurrentPrice":35366.29906086624,
"percentPL":44.12513919010135,"currentPrice":78780.25,
"breakEvenPrice":49308.33382316762,"inGreen":true,"totalBuyCost":80150,
"totalSellProfits":20980,"costBasis":59170,"netContributions":80150,
"netCashHoldings":20980}]
```
Byte-identical on both origins. Every numeric field is unquoted JSON (a JS `number`,
matching Prisma's type) on both origins - no drift.

**`GET /summary/portfolio` - user 8 (real history) - old vs new**
```
{"purchases":80150,"sales":20980,"costBasis":59170,"valueOfHoldings":94536.29906086624,
"totalPLatCurrentPrice":35366.29906086624,"netCashHoldings":20980,
"netContributions":80150,"accountValue":115516.29906086624,"realizedReturn":-59170,
"roi":44.12513919010135,"inGreen":true}
```
Byte-identical on both origins. Hand-verified against the seeded data: `purchases =
80150 = 50100 + 30050`; `sales = 20980`; `costBasis = purchases - sales = 59170`;
`accountValue = valueOfHoldings + netCashHoldings = 94536.3 + 20980 = 115516.3`;
`realizedReturn = netCashHoldings - netContributions = 20980 - 80150 = -59170`; `roi =
(totalPLatCurrentPrice / netContributions) * 100 = (35366.3 / 80150) * 100 = 44.125`.

**`GET /summary/coins` and `GET /summary/portfolio` - user 9 (zero history) - old vs new**
```
coins:     []
portfolio: {"purchases":null,"sales":null,"costBasis":null,"valueOfHoldings":null,
"totalPLatCurrentPrice":null,"netCashHoldings":0,"netContributions":0,
"accountValue":0,"realizedReturn":0,"roi":null,"inGreen":false}
```
Byte-identical on both origins for both endpoints - confirms `getPortfolioSummary`'s
aggregate-over-zero-rows `SUM` producing SQL `NULL` (deserialized as JS `null` on both
Prisma and MikroORM), and confirms the `roi = (null / 0) * 100` -> `NaN` ->
`JSON.stringify` -> `null` path the AC calls out, without any special-casing added.

**Unfiltered vs. `unit`/`onDate`-filtered `getCoinSummaries` (used by later stories, not
by this story's own endpoints)** - direct SQL check against `portfolio-db` confirmed
`AND trans.unit = ?` and `AND trans.date <= ?` compose correctly together (filtering to
just the two `BUY`s dated on/before `2024-02-15` produced `countSells: 0`,
`totalSellProfits: 0`, as expected for that cutoff).

**Unauthenticated**
`GET /backend/api/summary/coins` and `/summary/portfolio` with no session cookie -> both
`401 {"error":"Unauthorized"}` via `SessionGuard` + `AllExceptionsFilter` - no new
`@Res({ passthrough: false })` carve-out introduced.

All temporary `Transaction` rows (ids 2006-2008) and `User` rows (`story55temp`,
`story55temp2`) were deleted from `portfolio-db` afterward.

```
$ docker compose up -d --build
(full stack rebuilt and started cleanly)
$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}

$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
 M frontend/src/api/generated.ts
(non-empty - pure reorder, see "frontend/src/api/generated.ts diff is a pure reorder"
note above; committed)
```
