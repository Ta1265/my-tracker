# Story 5.7: Stats and product - GET /stats/:unit, GET /product/:product

Status: Done

## Context

Follows story 5.1's pattern. `stats/:unit` reuses story 5.5's
`SummaryService.getCoinSummaries` and story 5.2's `ExchangeRatesService.refreshRates()`
(`StatsModule` imports both `SummaryModule` and `ExchangeRatesModule`) - no new
aggregation query is written here. `product/:product` is fully self-contained: a plain
ORM query over `Transaction`, no cross-domain dependency.

**This is the story that formally settles architecture D18/F2 - two distinct USD
formatters ship, not one.** `frontend/src/server/helpers/format-usd.ts`'s `formatUSD`
(story 5.2 already ported it, since `exchange-rates/unit/:unit` needed it one story
early) and the separate local copy at `frontend/src/app/api/product/[product]/route.ts:7`
are genuinely different functions - for `1234.56`, the shared helper yields `"$1,235"`
and the product-route copy yields `"$1,234.56"`. **Do not unify them.** This story adds
the second one as `formatUsdPrecise` and documents the difference where a future reader
will look for it.

## Acceptance Criteria

### A. Two formatters, not one (D18)

- [x] `backend/src/common/formatting/format-usd.ts` (already holds `formatUSD` from
      story 5.2) gains a sibling export `formatUsdPrecise(value: number): string` -
      `value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })`, no
      threshold, no `wrapIfNegative` (`product/[product]/route.ts:7-8`, verbatim).
- [x] Add a two-line comment directly above `formatUsdPrecise` stating the behavioral
      difference from `formatUSD` for the same input (e.g. `1234.56` ->
      `"$1,235"` vs `"$1,234.56"`) and that this is deliberate, not a bug to unify -
      this is the one place in the backend a future reader will look when they notice
      two dollar formatters and wonder why.
- [x] Both are plain exported functions (D17 - not providers), imported directly by
      whichever service needs them.

### B. `StatsService`

- [x] `backend/src/stats/stats.service.ts` - `@Injectable()`, injects `SummaryService`
      and `ExchangeRatesService`.
- [x] `getStatsForUnit(userId: number, unit: string): Promise<StatsResponseDto>` - calls
      `exchangeRatesService.refreshRates()` then `summaryService.getCoinSummaries(userId,
      unit)`, formats every field per `stats/[unit]/route.ts:7-18` using `formatUSD`
      (not `formatUsdPrecise` - this endpoint uses the shared helper, confirmed in the
      inventory), and returns `formatted[0]`. **Reproduce the truncation-to-first-row
      behavior and the `undefined`-when-no-match behavior exactly**
      (`stats/[unit]/route.ts:29,31`, inventory's documented edge case): if
      `getCoinSummaries` returns zero rows for the unit, `formatted[0]` is `undefined`;
      verify what Nest actually does when a controller method resolves `undefined` for
      a `Promise<StatsResponseDto>` return type (Nest's default reply calls
      `response.json(undefined)` through the Express adapter) and confirm this produces
      an effectively empty `200` body matching `NextResponse.json(undefined)`'s
      behavior - if it does not (e.g. Nest throws a serialization error instead), use
      `@Res({ passthrough: false })` to reproduce the `200`-empty-body behavior
      explicitly rather than silently changing the contract. Record which case applies
      in Dev Notes; this is exactly the kind of edge case NFR-4's parity diff exists to
      catch.
- [x] `StatsModule` registers `StatsService` in `providers` and imports `SummaryModule`
      and `ExchangeRatesModule`.
- [x] `stats.controller.ts`'s `getByUnit` calls
      `statsService.getStatsForUnit(user.sub, unit)`.

### C. `ProductService`

- [x] `backend/src/product/product.service.ts` - `@Injectable()`, injects
      `EntityManager`.
- [x] `getTransactionsForProduct(userId: number, product: string):
      Promise<ProductTransactionResponseDto[]>`:
      - Empty/falsy `product` -> return `[]` immediately, no query
        (`product/[product]/route.ts:83`).
      - `em.find(Transaction, { unit: product, userId }, { orderBy: { date: 'desc' } })`
        (`route.ts:85-88` - note the route filters on `unit`, not `product`, despite the
        path param being named `product`; reproduce that exactly).
      - Port `calculateFIFOGains` and `formatTransactions` verbatim
        (`route.ts:13-74`): iterate oldest-to-newest (the array is `desc`, so walk it in
        reverse), maintain `runningBalance`/`runningCostBasis`/`taxLots`, compute
        `realizedGains` via FIFO lot matching on `SELL` rows (short/long split at 365
        days), then `unshift` each formatted row back into result order (most recent
        first). Use `formatUsdPrecise` (not `formatUSD`) for `price`/`fee`/`total`/
        `runningCostBasis`, matching the route-local copy this endpoint has always used
        - **this is the one endpoint that uses the precise formatter**; every other
        formatted endpoint in this epic uses `formatUSD`.
        `size`/`runningBalance`/`date` keep their existing non-formatUSD treatment
        (`.toString()`, `.toFixed(4)`, `.toLocaleString()` respectively).
- [x] `ProductModule` registers `ProductService` in `providers`.
- [x] `product.controller.ts`'s `getByProduct` calls
      `productService.getTransactionsForProduct(user.sub, product)`.

### D. Parity and regression

- [x] NFR-4: `GET /stats/{unit}` for a held unit against both origins - diff every
      formatted string field byte-for-byte. `GET /product/{product}` for a product with
      both BUY and SELL history against both origins - diff every field including
      `realizedGains`, confirm `price`/`fee`/`total`/`runningCostBasis` match the
      `formatUsdPrecise` output exactly (not `formatUSD`'s). Confirm an empty `product`
      param returns `[]` on both.
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.

## Technical Notes

### Entities

`backend/src/db/entities/transaction.entity.ts`.

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `stats/[unit]` and
`product/[product]` sections, and the "two USD formatters" landmine entry. Live source:
`frontend/src/app/api/stats/[unit]/route.ts`,
`frontend/src/app/api/product/[product]/route.ts`,
`frontend/src/server/helpers/format-usd.ts`.

### DTOs already scaffolded

`backend/src/stats/dto/stats-response.dto.ts`,
`backend/src/product/dto/product-transaction-response.dto.ts` - both complete from
Epic 2/2.3's worked example, no changes expected.

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

- `formatUSD` itself - already ported in story 5.2.
- `SummaryService.getCoinSummaries` / `ExchangeRatesService.refreshRates()` - stories
  5.5/5.2, consumed here.
- Both time-frame P/L endpoints - story 5.8.

## Dev Notes

### `stats/:unit`'s no-match case: old is a genuine 500 crash, not a 200-empty-body

AC B's premise - that `NextResponse.json(undefined)` produces an effectively empty
`200` body - does not hold. Live-tested against the running old route
(`GET /api/stats/NOPE`, a unit with zero transactions for the user): the old route
returns `HTTP/2 500` with a **fully empty body** (no `{error}` wrapping, since this
never reaches the route's own code - it crashes inside the framework). `next-app`'s
container logs confirm why: `NextResponse.json(undefined)` calls the WHATWG
`Response.json()` static method, which uses `serializeJavascriptValueToJSONString` and
throws `TypeError: Value is not JSON serializable` for `undefined` (JSON.stringify
silently drops `undefined`; `Response.json` does not). That's an unhandled exception in
the route handler, and Next's app-router runtime turns unhandled route-handler
exceptions into a generic 500 with no body - it never runs `catch` logic that would
attach an error JSON payload.

Separately, verified what Nest itself does with a plain `undefined` return: checked
`@nestjs/platform-express`'s `express-adapter.js` `reply()` -
`if (isNil(body)) { return response.send(); }` - so a controller resolving `undefined`
gets `response.send()` with no argument, i.e. an empty **200** body. Confirmed live
against the new route (`GET /backend/api/stats/NOPE`): `200`, `content-length: 0`.

So the two origins genuinely diverge on this edge case - old: `500` empty body (a
framework crash), new: `200` empty body (Nest's own default) - and this AC's assumed
"if it doesn't match, add `@Res`" branch doesn't apply either, because reproducing the
old side's crash-shaped `500` would require a third `@Res({ passthrough: false })`
carve-out in a controller that otherwise has none, which conflicts with this epic
keeping that carve-out to exactly two call sites (5.2's `exchange-rates/unit/:unit`,
5.9's metrics endpoint). Given `stats/:unit` has no known frontend caller (FR-4) - so
no live traffic depends on either shape - and forcing byte-parity here would mean
adding scaffolding whose only purpose is reproducing a framework crash, this is left as
the plain `formatted[0]` return the AC specifies (200 empty body) and flagged here as a
known, low-risk parity gap for the owner rather than silently "fixed" by working around
the carve-out limit. Everything else about AC B - the truncation-to-first-row read,
`formatUSD`-based field formatting, `refreshRates()` ordering - was verified byte-for-
byte identical for a unit that does have rows (see Verification below).

### Changed Files

+ backend/src/common/formatting/format-usd.ts   adds `formatUsdPrecise` (D18/F2's second, deliberately distinct USD formatter) beside `formatUSD`, with the two-line divergence comment
+ backend/src/stats/stats.service.ts            new `StatsService.getStatsForUnit` - `refreshRates()` then `SummaryService.getCoinSummaries(userId, unit)`, `formatUSD`-formats every field per the legacy route, returns `formatted[0]` (possibly `undefined`)
~ backend/src/stats/stats.controller.ts         `getByUnit` calls `StatsService.getStatsForUnit` instead of throwing; description now notes the empty-200 no-match case
~ backend/src/stats/stats.module.ts             imports `SummaryModule`/`ExchangeRatesModule`, registers `StatsService`
+ backend/src/product/product.service.ts        new `ProductService.getTransactionsForProduct` - empty-product short-circuit, `em.find(Transaction, { unit: product, userId })`, ported `calculateFIFOGains`/`formatTransactions` using `formatUsdPrecise` for price/fee/total/runningCostBasis
~ backend/src/product/product.controller.ts     `getByProduct` calls `ProductService.getTransactionsForProduct` instead of throwing; comment updated to name `formatUsdPrecise`
~ backend/src/product/product.module.ts         registers `ProductService`
~ frontend/src/api/generated.ts                 regenerated against the rebuilt `nest-api`; only change is `statsByUnit`'s JSDoc description picking up the controller's updated `@ApiOperation` text, no shape/behavior change

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

$ docker compose up -d --build
(full stack rebuilt and started cleanly - nest-api, next-app, nginx recreated;
portfolio-db/redis/loki/alloy/prometheus/grafana already running)

$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}
```

**Functional + parity checks (AC D)**

One temporary user (`story57temp`, id 12, bcrypt-hashed inside the running `nest-api`
container) and three temporary `Transaction` rows for unit `BTC` (ids 2011-2013) were
inserted directly into `portfolio-db`, deleted immediately after the checks:
- id 2011, `BUY`, `2024-01-01`, size 0.5, price 40000, fee 50, total -20050 (lot 1)
- id 2012, `BUY`, `2026-06-01`, size 0.5, price 60000, fee 50, total -30050 (lot 2)
- id 2013, `SELL`, `2026-08-01`, size 0.7, price 70000, fee 20, total 48980

This sell draws 0.5 from lot 1 (bought >365 days before the sell -> long-term gain) and
0.2 from lot 2 (bought ~61 days before the sell -> short-term gain), exercising both
branches of the FIFO split plus multi-lot consumption in one case.

Sessions: old-route session via the real NextAuth CSRF + credentials-callback flow
(`__Secure-next-auth.session-token`), new-route session via `POST
/backend/api/auth/login`. Both verified against `GET .../auth/session` resolving to the
same `User.id` (12).

**`GET /stats/BTC` (AC A/B) - old vs new, full raw body**
```
{"productName":"BTC","avgPurchasePrice":"$50,100","avgSellPrice":"$69,971","holdings":"0.3000",
"valueOfHoldings":"$23,462","profitLossAtCurrentPrice":"$22,342","percentPL":"44.6%",
"currentPrice":"$78,206","breakEvenPrice":"$3,733"}
```
Byte-identical on both origins.

**`GET /product/BTC` (AC C) - old vs new, full raw body**
```
[{"id":2013,"fullName":"Bitcoin","product":"BTC-USD","date":"8/1/2026, 12:00:00 AM","side":"SELL",
"size":"0.7","unit":"BTC","price":"$70,000.00","fee":"$20.00","total":"$48,980.00",
"notes":"story57 sell","runningBalance":"0.3000","runningCostBasis":"$1,120.00",
"realizedGains":{"total":16930,"short":1979.9999999999982,"long":14950}},
{"id":2012,"fullName":"Bitcoin","product":"BTC-USD","date":"6/1/2026, 12:00:00 AM","side":"BUY",
"size":"0.5","unit":"BTC","price":"$60,000.00","fee":"$50.00","total":"-$30,050.00",
"notes":"story57 lot2","runningBalance":"1.0000","runningCostBasis":"$50,100.00",
"realizedGains":{"total":0,"short":0,"long":0}},
{"id":2011,"fullName":"Bitcoin","product":"BTC-USD","date":"1/1/2024, 12:00:00 AM","side":"BUY",
"size":"0.5","unit":"BTC","price":"$40,000.00","fee":"$50.00","total":"-$20,050.00",
"notes":"story57 lot1","runningBalance":"0.5000","runningCostBasis":"$20,050.00",
"realizedGains":{"total":0,"short":0,"long":0}}]
```
Byte-identical on both origins, including: the `formatUsdPrecise` 2-decimal-always
formatting on `price`/`fee`/`total`/`runningCostBasis` (vs. `formatUSD`'s thresholded
0-decimal-above-$10 formatting seen in the `stats/BTC` response above); the unwrapped
negative `total` on the two `BUY` rows (`"-$30,050.00"`, `"-$20,050.00"` -
`formatUsdPrecise` never calls `wrapIfNegative`); and the FIFO `realizedGains.short`
value `1979.9999999999982` instead of the exact `1980` - this is the same
float-precision artifact flagged in story 5.6's Dev Notes (`Transaction.size`/`price`/
`total`'s `FLOAT`-column storage feeding float32-ish arithmetic), reproduced
identically on both origins here, not a new issue.

**Empty/no-match product** - `GET /product/%20` (a truthy, non-matching unit) and
`GET /product/ETHXYZ` (a real string, no rows) both return `[]` on both origins,
confirming the query path composes correctly for a no-match unit. The `!product`
early-return branch itself (`route.ts:83`) isn't reachable via HTTP routing on either
origin - Next's and Nest's dynamic-segment matching both require a non-empty path
segment - so it was verified by code inspection matching `product.service.ts`'s guard
to `route.ts:83` line-for-line rather than by request.

**`stats/:unit` no-match edge case** - see "Old is a genuine 500 crash" above for the
full investigation: old `GET /api/stats/NOPE` -> `500`, empty body (framework crash);
new `GET /backend/api/stats/NOPE` -> `200`, empty body (`content-length: 0`). Divergent,
flagged as a known low-risk gap rather than fixed via a third `@Res` carve-out.

**Unauthenticated**: `GET /backend/api/stats/BTC` and `/backend/api/product/BTC` with
no session cookie both returned `401 {"error":"Unauthorized"}`, matching
`/api/stats/BTC`/`/api/product/BTC`'s `401 {"error":"Unauthorized"}` on the old side -
via `SessionGuard` + `AllExceptionsFilter`, no new carve-out introduced.

The temporary `Transaction` rows (2011-2013) and `User` row (`story57temp`, id 12) were
deleted from `portfolio-db` after the checks.

```
$ docker compose up -d --build nest-api && docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
 M frontend/src/api/generated.ts
```
Non-empty: the only diff is `statsByUnit`'s JSDoc comment picking up the controller's
updated `@ApiOperation` description text (the no-match-200 note added above) - no
request/response shape change. Left staged for commit per the story's Verification
block.
